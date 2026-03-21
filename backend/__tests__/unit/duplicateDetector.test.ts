import { similarity } from '../../src/services/duplicateDetector.js';

describe('similarity', () => {
  it('идентичные строки → 1.0', () => expect(similarity('молоко', 'молоко')).toBe(1));

  it('полностью разные → < 0.4', () =>
    expect(similarity('молоко', 'арматура')).toBeLessThan(0.4));

  it('схожие с опечаткой', () =>
    expect(similarity('молоко 1л', 'молоко 1 л')).toBeGreaterThan(0.85));

  it('нормализация: регистр не влияет', () =>
    expect(similarity('Молоко', 'молоко')).toBe(1));
});
