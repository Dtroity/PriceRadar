export type InsertPricesOptions = {
    /** User who triggered the change (e.g. document confirm); null for workers/system */
    actorUserId?: string | null;
    /** Source document when prices come from invoice confirmation */
    documentId?: string | null;
};
export declare function insertPrices(priceListId: string, items: {
    product_id: string;
    price: number;
    currency: string;
}[], options?: InsertPricesOptions): Promise<void>;
export declare function getPricesByPriceListId(priceListId: string): Promise<{
    product_id: string;
    price: number;
    currency: string;
}[]>;
