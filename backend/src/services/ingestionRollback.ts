import { unlink } from 'fs/promises';
import { pool } from '../db/pool.js';
import * as documentsModel from '../models/documents.js';
import * as ingestionJobs from '../models/ingestionJobs.js';
import * as priceListsModel from '../models/priceLists.js';

function uploadDateToSql(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/**
 * Удаляет загрузку и связанные данные: прайс-лист (цены, связанные price_changes),
 * документ (строки, OCR-ошибки каскадом), строку ingestion, файл на диске.
 */
export async function removeIngestionAndArtifacts(organizationId: string, ingestionId: string): Promise<void> {
  const row = await ingestionJobs.getIngestionById(ingestionId, organizationId);
  if (!row) {
    throw new Error('Загрузка не найдена');
  }

  if (row.price_list_id) {
    const pl = await priceListsModel.getPriceListById(row.price_list_id);
    if (pl && (pl as { organization_id?: string }).organization_id === organizationId) {
      const supplierId = pl.supplier_id;
      const day = uploadDateToSql(pl.upload_date);
      await pool.query(
        `DELETE FROM supplier_prices_history
         WHERE organization_id = $1 AND supplier_id = $2 AND date = $3::date`,
        [organizationId, supplierId, day]
      );
      await priceListsModel.deletePriceList(organizationId, row.price_list_id);
    }
  }

  if (row.document_id) {
    await documentsModel.removeDocument(organizationId, row.document_id);
  }

  await unlink(row.stored_path).catch(() => {});
  await ingestionJobs.deleteIngestionRow(ingestionId, organizationId);
}
