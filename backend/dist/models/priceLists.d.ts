import type { PriceList, SourceType } from '../types/index.js';
export declare function createPriceList(supplierId: string, uploadDate: Date, sourceType: SourceType, filePath: string | null): Promise<PriceList>;
export declare function getLatestPriceListBySupplier(supplierId: string): Promise<PriceList | null>;
export declare function getPreviousPriceList(supplierId: string, beforeDate: Date): Promise<PriceList | null>;
