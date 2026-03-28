import type { PriceList, SourceType } from '../types/index.js';
export declare function createPriceList(supplierId: string, uploadDate: Date, sourceType: SourceType, filePath: string | null, organizationId?: string): Promise<PriceList>;
export declare function getLatestPriceListBySupplier(supplierId: string): Promise<PriceList | null>;
export declare function getPriceListById(priceListId: string): Promise<{
    id: string;
    supplier_id: string;
    organization_id?: string;
    upload_date: Date;
} | null>;
export declare function deletePriceList(organizationId: string, priceListId: string): Promise<boolean>;
export declare function getPreviousPriceList(supplierId: string, beforeDate: Date, organizationId?: string): Promise<PriceList | null>;
