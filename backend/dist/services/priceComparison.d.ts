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
 * 2. Compare prices by product_id and create price_changes
 */
export declare function compareAndSaveChanges(supplierId: string, newPriceListId: string, uploadDate: Date, organizationId?: string): Promise<ComparisonResult>;
