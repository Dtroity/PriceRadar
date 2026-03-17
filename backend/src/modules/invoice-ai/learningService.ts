import * as documentsModel from '../../models/documents.js';

/**
 * When user corrects document item product_id, store feedback for AI learning
 * if the corrected product_id differs from the previous (predicted) value.
 */
export async function recordFeedbackIfCorrected(
  organizationId: string,
  documentItemId: string,
  originalText: string,
  correctedProductId: string | null,
  previousProductId: string | null
): Promise<void> {
  if (correctedProductId === previousProductId) return;
  if (!originalText?.trim()) return;
  const correctedText = correctedProductId ?? '';
  await documentsModel.saveAiFeedback(
    organizationId,
    documentItemId,
    originalText,
    correctedText,
    correctedProductId
  );
}
