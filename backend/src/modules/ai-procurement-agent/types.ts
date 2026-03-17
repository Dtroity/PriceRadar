export interface ProcurementRecommendationInput {
  product_prices: { product_id: string; price: number; supplier_id?: string }[];
  price_forecasts?: { product_id: string; predicted_price: number; horizon_days: number }[];
  stock_levels?: { product_id: string; days_of_cover: number }[];
  supplier_prices?: { product_id: string; supplier_id: string; price: number }[];
  consumption_rates?: { product_id: string; units_per_day: number }[];
}

export interface RecommendedOrderLine {
  product_id: string;
  supplier_id: string;
  quantity: number;
  estimated_total: number;
  reason: string;
}

export interface ProcurementRecommendationsOutput {
  recommended_orders: RecommendedOrderLine[];
  recommended_suppliers: { product_id: string; supplier_id: string; score: number }[];
  expected_savings: number;
}
