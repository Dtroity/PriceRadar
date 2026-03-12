export declare function insertPrices(priceListId: string, items: {
    product_id: string;
    price: number;
    currency: string;
}[]): Promise<void>;
export declare function getPricesByPriceListId(priceListId: string): Promise<{
    product_id: string;
    price: number;
    currency: string;
}[]>;
