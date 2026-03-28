import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as ingestionJobs from '../models/ingestionJobs.js';
import { classifyIngestionFile, type IngestionKind } from '../services/ingestionClassifier.js';
import { decodeMultipartFilename } from '../utils/multipartFilename.js';
import { removeIngestionAndArtifacts } from '../services/ingestionRollback.js';
import type { SourceType } from '../types/index.js';
import { organizationHasModule } from '../modules/_shared/subscriptionRepository.js';
import {
  applyPostClassificationRouting,
  classificationFromDetection,
  detectionFromClassification,
  routeAfterConfirm,
  routeIngestionWithoutUiConfirm,
} from '../services/ingestionOrchestrate.js';

async function canUsePrice(orgId: string, role: string | undefined): Promise<boolean> {
  if (role === 'super_admin') return true;
  return organizationHasModule(orgId, 'price_monitoring');
}

async function canUseInvoice(orgId: string, role: string | undefined): Promise<boolean> {
  if (role === 'super_admin') return true;
  return organizationHasModule(orgId, 'invoice_ai');
}

function serializeIngestion(row: ingestionJobs.IngestionJobRow) {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    suggestedKind: row.suggested_kind,
    confirmedKind: row.confirmed_kind,
    status: row.status,
    detection: row.detection,
    bullmqJobId: row.bullmq_job_id,
    documentId: row.document_id,
    priceListId: row.price_list_id,
    errorMessage: row.error_message,
    summary: row.summary,
    duplicateOfId: row.duplicate_of_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function postInit(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Нужна организация в сессии' });
    }
    const role = req.user?.role;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не передан' });
    }

    const okPrice = await canUsePrice(organizationId, role);
    const okInv = await canUseInvoice(organizationId, role);
    if (!okPrice && !okInv) {
      return res.status(403).json({ error: 'Нет доступных модулей для загрузки файлов' });
    }

    const originalName = decodeMultipartFilename(file.originalname);
    const sourceType = ((req.body.sourceType as string) || 'web') as SourceType;
    if (!['web', 'telegram', 'camera', 'email'].includes(sourceType)) {
      return res.status(400).json({ error: 'Неверный sourceType' });
    }

    const allowDuplicate = String(req.body.allowDuplicate || '') === 'true';
    const buf = await readFile(file.path);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const dup = allowDuplicate ? null : await ingestionJobs.findRecentDuplicateByHash(organizationId, sha256, 90);

    const classification = await classifyIngestionFile({
      filePath: file.path,
      mimeType: file.mimetype,
      originalName,
    });

    const detectionPayload = detectionFromClassification(classification);

    if (dup) {
      const job = await ingestionJobs.createIngestionJob({
        organizationId,
        userId: req.user?.userId ?? null,
        originalFilename: originalName,
        storedPath: file.path,
        mimeType: file.mimetype,
        sourceType,
        fileSha256: sha256,
        suggestedKind: classification.suggested,
        status: 'pending_duplicate_confirm',
        detection: { ...detectionPayload, pendingDuplicate: true },
        duplicateOfId: dup.id,
      });
      return res.status(200).json({
        ingestion: serializeIngestion(job),
        needsConfirmation: false,
        needsDuplicateDecision: true,
        duplicateOf: { id: dup.id, createdAt: dup.created_at.toISOString() },
      });
    }

    const job = await ingestionJobs.createIngestionJob({
      organizationId,
      userId: req.user?.userId ?? null,
      originalFilename: originalName,
      storedPath: file.path,
      mimeType: file.mimetype,
      sourceType,
      fileSha256: sha256,
      suggestedKind: classification.suggested,
      status: 'pending_confirm',
      detection: detectionPayload,
    });

    const supplierName = ((req.body.supplierName as string) || '').trim();

    const routed = await applyPostClassificationRouting(
      job,
      organizationId,
      role,
      supplierName,
      sourceType,
      classification
    );

    if (routed.mode === 'auto') {
      const fresh = (await ingestionJobs.getIngestionById(job.id, organizationId))!;
      return res.status(202).json({
        ingestion: serializeIngestion(fresh),
        needsConfirmation: false,
        ...routed.meta,
        bullmqJobId: routed.bullmqJobId,
        documentId: routed.documentId,
      });
    }

    return res.status(200).json({
      ingestion: serializeIngestion(job),
      needsConfirmation: true,
      suggestedKind: classification.suggested,
      alternateKind: classification.alternate,
      detection: detectionPayload,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Ошибка инициализации загрузки' });
  }
}

export async function postDuplicateDecision(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Нужна организация в сессии' });
    }
    const role = req.user?.role;
    const id = req.params.id;
    const proceed = Boolean(req.body?.proceed);
    const supplierName = String(req.body?.supplierName ?? '').trim();
    const sourceType = ((req.body.sourceType as string) || 'web') as SourceType;

    const row = await ingestionJobs.getIngestionById(id, organizationId);
    if (!row) {
      return res.status(404).json({ error: 'Загрузка не найдена' });
    }
    if (row.status !== 'pending_duplicate_confirm') {
      return res.status(400).json({ error: 'Решение по дубликату уже принято или не требуется' });
    }

    if (!proceed) {
      await unlink(row.stored_path).catch(() => {});
      await ingestionJobs.deleteIngestionRow(id, organizationId);
      return res.json({ ok: true, cancelled: true });
    }

    const classification = classificationFromDetection(row.detection);
    const detectionClean = detectionFromClassification(classification);
    await ingestionJobs.updateIngestionJob(id, organizationId, {
      status: 'pending_confirm',
      detection: detectionClean,
    });
    const ready = (await ingestionJobs.getIngestionById(id, organizationId))!;

    const routed = await routeIngestionWithoutUiConfirm(
      ready,
      organizationId,
      role,
      classification,
      supplierName,
      sourceType
    );

    const fresh = (await ingestionJobs.getIngestionById(id, organizationId))!;
    return res.status(202).json({
      ok: true,
      ingestion: serializeIngestion(fresh),
      bullmqJobId: routed.bullmqJobId,
      documentId: routed.documentId,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка' });
  }
}

export async function postConfirm(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Нужна организация в сессии' });
    }
    const role = req.user?.role;
    const id = req.params.id;
    const kind = req.body.kind as IngestionKind;
    if (kind !== 'price_list' && kind !== 'invoice_document') {
      return res.status(400).json({ error: 'Укажите kind: price_list или invoice_document' });
    }
    const supplierName = ((req.body.supplierName as string) || '').trim();
    const supplierResolved = kind === 'price_list' ? supplierName || 'Unknown Supplier' : supplierName;
    const sourceType = ((req.body.sourceType as string) || 'web') as SourceType;

    const row = await ingestionJobs.getIngestionById(id, organizationId);
    if (!row) {
      return res.status(404).json({ error: 'Загрузка не найдена' });
    }
    if (row.status !== 'pending_confirm') {
      return res.status(400).json({ error: 'Подтверждение уже не требуется или обработка началась' });
    }

    const routed = await routeAfterConfirm(row, organizationId, kind, supplierResolved, sourceType, role);
    const fresh = await ingestionJobs.getIngestionById(id, organizationId);
    return res.status(202).json({
      ingestion: serializeIngestion(fresh!),
      ...routed,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Ошибка подтверждения' });
  }
}

export async function getOne(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
  const row = await ingestionJobs.getIngestionById(req.params.id, organizationId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(serializeIngestion(row));
}

export async function list(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 80));
  const rows = await ingestionJobs.listIngestionJobs(organizationId, limit);
  return res.json({ items: rows.map(serializeIngestion) });
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    await removeIngestionAndArtifacts(organizationId, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Не удалось удалить' });
  }
}
