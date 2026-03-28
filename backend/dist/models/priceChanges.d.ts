import type { PriceChange } from '../types/index.js';
export interface PriceChangeFilters {
    organizationId?: string;
    supplierId?: string;
    fromDate?: string;
    toDate?: string;
    minPercent?: number;
    maxPercent?: number;
    priorityOnly?: boolean;
}
export declare function createPriceChange(productId: string, supplierId: string, oldPrice: number, newPrice: number, isPriority: boolean, organizationId?: string, sourcePriceListId?: string | null): Promise<PriceChange>;
export declare function getPriceChanges(filters?: PriceChangeFilters, limit?: number): Promise<(PriceChange & {
    product_name: string;
    supplier_name: string;
})[]>;
export declare function getPriceHistory(productId: string, supplierId?: string): Promise<{
    date: string;
    price: number;
}[]>;
