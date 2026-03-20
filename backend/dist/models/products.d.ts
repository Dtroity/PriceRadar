import type { Product } from '../types/index.js';
export declare function getAllProducts(organizationId?: string): Promise<Product[]>;
export declare function getProductById(id: string): Promise<Product | null>;
export declare function findProductByNormalizedName(normalizedName: string, organizationId?: string): Promise<Product | null>;
export declare function createProduct(name: string, normalizedName: string, isPriority?: boolean, organizationId?: string): Promise<Product>;
export declare function findOrCreateProduct(name: string, normalizedName: string, isPriority?: boolean, organizationId?: string): Promise<Product>;
export declare function setProductPriority(productId: string, isPriority: boolean): Promise<void>;
export declare function setProductPriorityWithAudit(productId: string, isPriority: boolean, organizationId: string, actorUserId: string | null): Promise<void>;
export interface MergeProductsParams {
    organizationId: string;
    targetProductId: string;
    sourceProductIds: string[];
    /** User who performed merge (null for system / auto-merge) */
    actorUserId?: string | null;
}
export interface MergeProductsResult {
    mergedSourceIds: string[];
}
/**
 * Atomically reassigns all product_id FKs from sources to target, merges stock / dedupes
 * where unique constraints apply, then deletes source product rows.
 */
export declare function mergeProducts(params: MergeProductsParams): Promise<MergeProductsResult>;
