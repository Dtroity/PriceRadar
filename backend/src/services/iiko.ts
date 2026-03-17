/**
 * iiko integration stub.
 * Real implementation would use iiko API: organizations, warehouses, products, create incoming invoice.
 */
import { config } from '../config.js';

export interface IikoCredentials {
  apiLogin?: string;
  token?: string;
  baseUrl?: string;
}

export async function getOrganizations(creds: IikoCredentials): Promise<unknown[]> {
  if (!creds?.apiLogin) return [];
  // TODO: call iiko API
  return [];
}

export async function getWarehouses(creds: IikoCredentials): Promise<unknown[]> {
  if (!creds?.apiLogin) return [];
  return [];
}

export async function getProducts(creds: IikoCredentials): Promise<unknown[]> {
  if (!creds?.apiLogin) return [];
  return [];
}

export async function createIncomingInvoice(
  creds: IikoCredentials,
  _payload: { items: Array<{ productId: string; quantity: number; price: number }> }
): Promise<{ success: boolean; id?: string }> {
  if (!creds?.apiLogin) return { success: false };
  // TODO: map our product_id to iiko nomenclature, post document
  return { success: true };
}
