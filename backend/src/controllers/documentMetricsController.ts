import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import { pool } from '../db/pool.js';

export async function documentMetrics(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const [total, parsed, needsReview, failed, avgConf, feedbackCount, errorCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS c FROM documents WHERE organization_id = $1`, [organizationId]),
      pool.query(`SELECT COUNT(*) AS c FROM documents WHERE organization_id = $1 AND status = 'parsed'`, [organizationId]),
      pool.query(`SELECT COUNT(*) AS c FROM documents WHERE organization_id = $1 AND status = 'needs_review'`, [organizationId]),
      pool.query(`SELECT COUNT(*) AS c FROM documents WHERE organization_id = $1 AND status = 'failed'`, [organizationId]),
      pool.query(`SELECT AVG(confidence)::numeric(5,2) AS c FROM documents WHERE organization_id = $1 AND confidence IS NOT NULL`, [organizationId]),
      pool.query(`SELECT COUNT(*) AS c FROM ai_feedback af JOIN document_items di ON di.id = af.document_item_id JOIN documents d ON d.id = di.document_id WHERE d.organization_id = $1`, [organizationId]),
      pool.query(`SELECT COUNT(*) AS c FROM processing_errors pe JOIN documents d ON d.id = pe.document_id WHERE d.organization_id = $1`, [organizationId]),
    ]);

    const totalDoc = Number(total.rows[0]?.c ?? 0);
    const parsedCount = Number(parsed.rows[0]?.c ?? 0);
    const needsReviewCount = Number(needsReview.rows[0]?.c ?? 0);
    const failedCount = Number(failed.rows[0]?.c ?? 0);
    const ocrSuccessRate = totalDoc > 0 ? (parsedCount + needsReviewCount) / totalDoc : 0;
    const manualCorrectionsPct = totalDoc > 0 ? Number(feedbackCount.rows[0]?.c ?? 0) / totalDoc : 0;

    res.json({
      total_documents: totalDoc,
      ocr_success_rate: Math.round(ocrSuccessRate * 100) / 100,
      average_confidence: avgConf.rows[0]?.c != null ? Number(avgConf.rows[0].c) : null,
      documents_needing_review: needsReviewCount,
      failed_documents: failedCount,
      manual_corrections_percent: Math.round(manualCorrectionsPct * 10000) / 100,
      processing_errors_count: Number(errorCount.rows[0]?.c ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get document metrics' });
  }
}
