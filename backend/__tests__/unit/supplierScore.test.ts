import { calcPriceStability } from '../../src/models/analyticsModel.js';

describe('calcPriceStability', () => {
  it('все цены одинаковые → стабильность 1.0', () =>
    expect(calcPriceStability([100, 100, 100])).toBe(1));

  it('пустой массив → 1.0 (нет данных = стабильно)', () =>
    expect(calcPriceStability([])).toBe(1));

  it('сильный разброс → стабильность < 0.5', () =>
    expect(calcPriceStability([50, 100, 200])).toBeLessThan(0.5));
});
