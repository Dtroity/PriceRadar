import * as documentsModel from '../../models/documents.js';
import * as repo from './repository.js';

export async function applyInvoice(documentId: string, organizationId: string): Promise<void> {
  const doc = await documentsModel.getById(documentId, organizationId);
  if (!doc) return;
  const items = await documentsModel.getItems(documentId);
  for (const it of items) {
    if (!it.product_id || it.quantity <= 0) continue;
    await repo.addStock(organizationId, it.product_id, it.quantity, 'invoice', `document:${documentId}`);
  }
}
