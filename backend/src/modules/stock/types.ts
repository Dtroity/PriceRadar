export type MovementType = 'invoice' | 'manual' | 'recipe_usage' | 'correction';

export interface ProductStock {
  id: string;
  organization_id: string;
  product_id: string;
  current_stock: number;
  unit: string | null;
  updated_at: Date;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  quantity: number;
  movement_type: MovementType;
  source: string | null;
  created_at: Date;
}
