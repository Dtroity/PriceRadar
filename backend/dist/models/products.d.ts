import type { Product } from '../types/index.js';
export declare function getAllProducts(): Promise<Product[]>;
export declare function getProductById(id: string): Promise<Product | null>;
export declare function findProductByNormalizedName(normalizedName: string): Promise<Product | null>;
export declare function createProduct(name: string, normalizedName: string, isPriority?: boolean): Promise<Product>;
export declare function findOrCreateProduct(name: string, normalizedName: string, isPriority?: boolean): Promise<Product>;
export declare function setProductPriority(productId: string, isPriority: boolean): Promise<void>;
