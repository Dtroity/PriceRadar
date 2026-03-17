import * as repo from './repository.js';

export async function getRecommendations(organizationId: string, productId: string) {
  const prices = await repo.getCurrentPricesByProduct(organizationId, productId);
  const scores = await repo.getSupplierScores(organizationId);
  const scoreBySupplier = new Map(scores.map((r: { supplier_id: string; total_score: number }) => [r.supplier_id, r.total_score]));

  const withScore = prices.map((p: { supplier_id: string; price: number; supplier_name: string }) => ({
    supplier_id: p.supplier_id,
    supplier_name: p.supplier_name,
    price: Number(p.price),
    score: scoreBySupplier.get(p.supplier_id) ?? 50,
  }));

  if (withScore.length === 0) {
    return { best_supplier: null, alternative_suppliers: [], price_comparison: [], expected_savings: 0 };
  }

  withScore.sort((a, b) => {
    if (Math.abs(a.price - b.price) < 0.01) return (b.score ?? 0) - (a.score ?? 0);
    return a.price - b.price;
  });

  const best = withScore[0];
  const alternatives = withScore.slice(1, 6);
  const priceComparison = withScore.map((p) => ({ supplier_id: p.supplier_id, supplier_name: p.supplier_name, price: p.price }));
  const highestPrice = Math.max(...withScore.map((p) => p.price));
  const expectedSavings = highestPrice > best.price ? highestPrice - best.price : 0;

  return {
    best_supplier: { supplier_id: best.supplier_id, supplier_name: best.supplier_name, price: best.price },
    alternative_suppliers: alternatives.map((a) => ({ supplier_id: a.supplier_id, supplier_name: a.supplier_name, price: a.price })),
    price_comparison: priceComparison,
    expected_savings: expectedSavings,
  };
}
