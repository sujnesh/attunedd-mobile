import { calculateCardioStress } from '../engine/cardioStress';

describe('calculateCardioStress', () => {
  it('Zone 2 intensity is 1.0', () => {
    expect(calculateCardioStress(30, 'Zone 2')).toBeCloseTo(30);
  });

  it('Zone 3 intensity is 1.4', () => {
    expect(calculateCardioStress(30, 'Zone 3')).toBeCloseTo(42);
  });

  it('Zone 4 intensity is 1.8', () => {
    expect(calculateCardioStress(30, 'Zone 4')).toBeCloseTo(54);
  });

  it('Zone 5 intensity is 1.8 (same as Zone 4)', () => {
    expect(calculateCardioStress(30, 'Zone 5')).toBeCloseTo(54);
  });

  it('unknown zone defaults to intensity 1.0', () => {
    expect(calculateCardioStress(45, 'Zone 1')).toBeCloseTo(45);
  });

  it('empty string zone defaults to intensity 1.0', () => {
    expect(calculateCardioStress(60, '')).toBeCloseTo(60);
  });

  it('returns 0 for 0 duration', () => {
    expect(calculateCardioStress(0, 'Zone 3')).toBe(0);
  });

  it('handles fractional duration', () => {
    // 15.5 * 1.4 = 21.7
    expect(calculateCardioStress(15.5, 'Zone 3')).toBeCloseTo(21.7);
  });
});
