import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as documentsModel from '../models/documents.js';
import * as suppliersModel from '../models/suppliers-mt.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import { compareAndSaveChanges } from '../services/priceComparison.js';
import { matchProductForRow } from '../product-matching/matchingService.js';
import { normalizeRow } from '../services/normalize.js';
import { documentQueue } from '../workers/queue.js';
import { recordFeedbackIfCorrected } from '../modules/invoice-ai/learningService.js';
import { learnFromMapping } from '../modules/invoice-ai/aliasLearningService.js';
import { recordFromPriceList } from '../services/supplierPricesHistory.js';
import { stockUpdateQueue } from '../modules/stock/worker.js';
import type { SourceType } from '../types/index.js';

export async function upload(req: AuthRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const sourceType = ((req.body.sourceType as string) || 'web') as SourceType;
    if (!['web', 'telegram', 'camera', 'email'].includes(sourceType)) {
      return res.status(400).json({ error: 'Invalid sourceType' });
    }

    const doc = await documentsModel.create(organizationId, file.path, sourceType);
    await documentQueue.add(
      'parse',
      {
        documentId: doc.id,
        organizationId,
        filePath: file.path,
        mimeType: file.mimetype,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
    return res.status(202).json({ message: 'Document queued for processing', documentId: doc.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

export async function list(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const status = req.query.status as string | undefined;
    const list = await documentsModel.list(
      organizationId,
      status ? { status: status as 'pending' | 'parsed' | 'needs_review' | 'verified' | 'failed' } : {},
      50
    );
    return res.json(list);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list documents' });
  }
}

type ListFilters = { status?: import('../types/index.js').DocumentStatus };

export async function getById(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const id = req.params.id;
    const doc = await documentsModel.getById(id, organizationId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const items = await documentsModel.getItems(id);
    return res.json({ ...doc, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to get document' });
  }
}

export async function patchItem(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const documentId = req.params.id;
    const itemId = req.params.itemId;
    const body = req.body as {
      name?: string;
      quantity?: number;
      unit?: string;
      price?: number;
      sum?: number;
      vat?: number;
      product_id?: string | null;
      needs_review?: boolean;
      save_feedback?: boolean;
      original_text?: string;
      corrected_text?: string;
    };

    const doc = await documentsModel.getById(documentId, organizationId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const itemsBefore = await documentsModel.getItems(documentId);
    const itemBefore = itemsBefore.find((i) => i.id === itemId);
    const previousProductId = itemBefore?.product_id ?? null;
    const originalText = body.original_text ?? itemBefore?.name ?? '';

    await documentsModel.updateItem(itemId, documentId, organizationId, {
      name: body.name,
      quantity: body.quantity,
      unit: body.unit,
      price: body.price,
      sum: body.sum,
      vat: body.vat,
      product_id: body.product_id,
      needs_review: body.needs_review,
    });

    if (body.product_id != null && body.product_id !== previousProductId) {
      try {
        await recordFeedbackIfCorrected(
          organizationId,
          itemId,
          originalText,
          body.product_id,
          previousProductId
        );
      } catch {
        // ignore
      }
      if (doc.supplier_name && (body.name ?? itemBefore?.name)) {
        try {
          await learnFromMapping(
            organizationId,
            doc.supplier_name,
            (body.name ?? itemBefore?.name) ?? '',
            body.product_id
          );
        } catch {
          // ignore
        }
      }
    }
    if (body.save_feedback && body.original_text != null && body.corrected_text != null) {
      try {
        await documentsModel.saveAiFeedback(
          organizationId,
          itemId,
          body.original_text,
          body.corrected_text,
          body.product_id ?? null
        );
      } catch {
        // ignore
      }
    }
    const items = await documentsModel.getItems(documentId);
    const item = items.find((i) => i.id === itemId);
    return res.json(item ?? {});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update item' });
  }
}

export async function confirm(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const documentId = req.params.id;

    const doc = await documentsModel.getById(documentId, organizationId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status === 'verified') return res.status(400).json({ error: 'Document already verified' });

    let supplierId = doc.supplier_id;
    if (!supplierId && doc.supplier_name) {
      const supplier = await suppliersModel.findOrCreate(organizationId, doc.supplier_name);
      supplierId = supplier.id;
      await documentsModel.updateParsed(documentId, organizationId, { supplier_id: supplier.id });
    }
    if (!supplierId) return res.status(400).json({ error: 'Supplier required to confirm' });

    let items = await documentsModel.getItems(documentId);
    const supplierName = doc.supplier_name ?? '';

    for (const it of items) {
      if (it.product_id || !it.name) continue;
      const row = normalizeRow(it.name, it.price ?? 0, 'RUB', supplierName);
      const product = await matchProductForRow(row, supplierName, organizationId);
      await documentsModel.updateItemProduct(it.id, documentId, product.id);
    }
    items = await documentsModel.getItems(documentId);

    const priceItems: { product_id: string; price: number; currency: string }[] = [];
    for (const it of items) {
      if (!it.product_id || !it.price) continue;
      priceItems.push({ product_id: it.product_id, price: it.price, currency: 'RUB' });
    }

    if (priceItems.length > 0) {
      const uploadDate = doc.document_date ? new Date(doc.document_date) : new Date();
      const priceList = await priceListsModel.createPriceList(
        supplierId,
        uploadDate,
        doc.source_type,
        doc.file_path,
        organizationId
      );
      await pricesModel.insertPrices(priceList.id, priceItems);
      await recordFromPriceList(priceList.id).catch(() => {});
      await compareAndSaveChanges(supplierId, priceList.id, uploadDate, organizationId);
    }

    await documentsModel.updateParsed(documentId, organizationId, { status: 'verified' });
    await stockUpdateQueue.add('apply-invoice', { documentId, organizationId }).catch(() => {});
    return res.json({ message: 'Document verified', status: 'verified' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Confirm failed' });
  }
}
