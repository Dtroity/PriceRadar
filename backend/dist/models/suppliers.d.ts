import type { Supplier } from '../types/index.js';
export declare function getAllSuppliers(): Promise<Supplier[]>;
export declare function getSupplierById(id: string): Promise<Supplier | null>;
export declare function createSupplier(name: string): Promise<Supplier>;
export declare function findOrCreateSupplier(name: string): Promise<Supplier>;
