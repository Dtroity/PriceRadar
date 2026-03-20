export declare function getTelegramBot(): any;
export declare function notifyPriceChange(supplierName: string, productName: string, oldPrice: number, newPrice: number, changePercent: number, isPriority: boolean): Promise<void>;
export declare function notifyLowStock(organizationId: string, productName: string, daysRemaining: number, recommendedQty: number, supplierName: string, expectedSavingsPct?: number): Promise<void>;
export declare function notifyAutopilotOrder(organizationId: string, orderId: string, itemCount: number): Promise<void>;
