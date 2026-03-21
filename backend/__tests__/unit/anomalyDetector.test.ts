/** Pure implementation lives in anomalyClassifier (re-exported from anomalyDetector). */
import { classifyAnomaly } from '../../src/services/anomalyClassifier.js';

describe('classifyAnomaly — пороги', () => {
  it('oldPrice=null → null (первое появление)', () => expect(classifyAnomaly(null, 100)).toBeNull());

  it('oldPrice=0 → null (деление на ноль)', () => expect(classifyAnomaly(0, 100)).toBeNull());

  it('изменение 7.9% → null (ниже low)', () =>
    expect(classifyAnomaly(100, 107.9)).toBeNull());

  it('ровно 8% → low up', () =>
    expect(classifyAnomaly(100, 108)).toMatchObject({ severity: 'low', direction: 'up' }));

  it('14.9% → low up (не medium)', () =>
    expect(classifyAnomaly(100, 114.9)).toMatchObject({ severity: 'low', direction: 'up' }));

  it('ровно 15% → medium up', () =>
    expect(classifyAnomaly(100, 115)).toMatchObject({ severity: 'medium', direction: 'up' }));

  it('ровно 30% → high up', () =>
    expect(classifyAnomaly(100, 130)).toMatchObject({ severity: 'high', direction: 'up' }));

  it('падение 30% → high down', () =>
    expect(classifyAnomaly(100, 70)).toMatchObject({ severity: 'high', direction: 'down' }));

  it('падение 8% → low down', () =>
    expect(classifyAnomaly(100, 92)).toMatchObject({ severity: 'low', direction: 'down' }));
});
