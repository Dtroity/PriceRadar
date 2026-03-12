import type { NormalizedRow } from '../types/index.js';
export interface ComparisonResult {
    changes: Array<{
        productId: string;
        productName: string;
        oldPrice: number;
        newPrice: number;
        changeValue: number;
        changePercent: number;
        isPriority: boolean;
    }>;
}
/**
 * After saving new price list and prices:
 * 1. Find previous price list for this supplier
 * 2. Match products by normalized_name
 * 3. Compare prices and create price_changes
 */
export declare function compareAndSaveChanges(supplierId: string, newPriceListId: string, newRows: NormalizedRow[], uploadDate: Date): Promise<ComparisonResult>;
