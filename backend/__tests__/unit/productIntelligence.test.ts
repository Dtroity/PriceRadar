import { calculatePriorityScore, computePriorityScoreParts } from '../../src/domains/product-intelligence/productIntelligence.service.js';

describe('product intelligence priority', () => {
  it('computePriorityScoreParts matches weighted sum', () => {
    const parts = computePriorityScoreParts({
      usageCount: 50,
      lastUsedAt: new Date(),
      priceStdDev: 10,
      isFavorite: true,
    });
    expect(parts.usage).toBe(100);
    expect(parts.recency).toBeGreaterThan(90);
    expect(parts.volatility).toBe(100);
    expect(parts.manual).toBe(100);
    const expected =
      parts.usage * 0.4 + parts.recency * 0.2 + parts.volatility * 0.2 + parts.manual * 0.2;
    expect(parts.score).toBeCloseTo(expected, 5);
  });

  it('favorite boosts manual component', () => {
    const off = calculatePriorityScore({
      usageCount: 0,
      lastUsedAt: null,
      priceStdDev: 0,
      isFavorite: false,
    });
    const on = calculatePriorityScore({
      usageCount: 0,
      lastUsedAt: null,
      priceStdDev: 0,
      isFavorite: true,
    });
    expect(on - off).toBeCloseTo(20, 5);
  });

  it('calculatePriorityScore is stable for zero usage', () => {
    const s = calculatePriorityScore({
      usageCount: 0,
      lastUsedAt: null,
      priceStdDev: 0,
      isFavorite: false,
    });
    expect(s).toBe(0);
  });
});
