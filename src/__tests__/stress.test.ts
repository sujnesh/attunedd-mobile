import {
  calculateStrengthStress,
  calculateBodyweightStress,
  calculateStress,
  midpointReps,
} from '../engine/stress';

describe('calculateStrengthStress', () => {
  it('computes weight * reps * (1 + (10 - rpe) * 0.05)', () => {
    // 100 * 5 * (1 + (10 - 8) * 0.05) = 100 * 5 * 1.10 = 550
    expect(calculateStrengthStress(100, 5, 8)).toBeCloseTo(550);
  });

  it('at RPE 10 the multiplier is 1.0', () => {
    // 200 * 3 * (1 + 0) = 600
    expect(calculateStrengthStress(200, 3, 10)).toBeCloseTo(600);
  });

  it('at RPE 5 the multiplier is 1.25', () => {
    // 80 * 10 * (1 + 5 * 0.05) = 80 * 10 * 1.25 = 1000
    expect(calculateStrengthStress(80, 10, 5)).toBeCloseTo(1000);
  });

  it('returns 0 when weight is 0', () => {
    expect(calculateStrengthStress(0, 10, 8)).toBe(0);
  });

  it('returns 0 when reps is 0', () => {
    expect(calculateStrengthStress(100, 0, 8)).toBe(0);
  });

  it('handles fractional weight', () => {
    // 2.5 * 12 * (1 + (10 - 7) * 0.05) = 2.5 * 12 * 1.15 = 34.5
    expect(calculateStrengthStress(2.5, 12, 7)).toBeCloseTo(34.5);
  });
});

describe('calculateBodyweightStress', () => {
  it('computes reps * rpe', () => {
    expect(calculateBodyweightStress(10, 8)).toBe(80);
  });

  it('returns 0 when reps is 0', () => {
    expect(calculateBodyweightStress(0, 9)).toBe(0);
  });

  it('returns 0 when rpe is 0', () => {
    expect(calculateBodyweightStress(15, 0)).toBe(0);
  });
});

describe('calculateStress', () => {
  it('uses strength formula when weight > 0', () => {
    const result = calculateStress(100, 5, 8);
    expect(result).toBeCloseTo(550);
  });

  it('uses bodyweight formula when weight is null', () => {
    expect(calculateStress(null, 10, 8)).toBe(80);
  });

  it('uses bodyweight formula when weight is 0', () => {
    expect(calculateStress(0, 10, 8)).toBe(80);
  });

  it('uses bodyweight formula when weight is negative', () => {
    expect(calculateStress(-5, 10, 8)).toBe(80);
  });

  it('uses strength formula for small positive weight', () => {
    // 0.5 * 20 * (1 + (10 - 6) * 0.05) = 0.5 * 20 * 1.2 = 12
    expect(calculateStress(0.5, 20, 6)).toBeCloseTo(12);
  });
});

describe('midpointReps', () => {
  it('returns 10 for null', () => {
    expect(midpointReps(null)).toBe(10);
  });

  it('returns 10 for undefined', () => {
    expect(midpointReps(undefined)).toBe(10);
  });

  it('returns 10 for empty string', () => {
    expect(midpointReps('')).toBe(10);
  });

  it('returns 10 for whitespace-only string', () => {
    expect(midpointReps('   ')).toBe(10);
  });

  it('parses range "8-10" as midpoint 9', () => {
    expect(midpointReps('8-10')).toBe(9);
  });

  it('parses range "6-12" as midpoint 9', () => {
    expect(midpointReps('6-12')).toBe(9);
  });

  it('parses range "3-5" as midpoint 4', () => {
    expect(midpointReps('3-5')).toBe(4);
  });

  it('parses odd range "1-4" as 2.5', () => {
    expect(midpointReps('1-4')).toBe(2.5);
  });

  it('parses single value "8" as 8', () => {
    expect(midpointReps('8')).toBe(8);
  });

  it('parses single value "12" as 12', () => {
    expect(midpointReps('12')).toBe(12);
  });

  it('returns 10 for single "0"', () => {
    expect(midpointReps('0')).toBe(10);
  });

  it('handles non-numeric string (Ruby parity: to_i returns 0)', () => {
    // "abc" -> parseInt = NaN -> 0 -> single value 0 -> returns 10
    expect(midpointReps('abc')).toBe(10);
  });

  it('handles range with non-numeric part "5-abc"', () => {
    // "5" -> 5, "abc" -> 0, length 2 -> (5 + 0) / 2 = 2.5
    expect(midpointReps('5-abc')).toBe(2.5);
  });
});
