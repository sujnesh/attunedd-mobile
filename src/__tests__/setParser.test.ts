import {
  parseSetInput,
  isParseError,
  rpeToRir,
  formatSetDisplay,
  type ParsedSet,
  type ParseError,
} from '../services/setParser';

describe('parseSetInput', () => {
  it('parses weight×reps with RIR using r notation', () => {
    const result = parseSetInput('bench press 80x8 r2');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.exerciseName).toBe('bench press');
    expect(set.weight).toBe(80);
    expect(set.reps).toBe(8);
    expect(set.rpe).toBe(8); // RPE = 10 - RIR(2)
  });

  it('parses weight×reps with RIR using @ notation', () => {
    const result = parseSetInput('squat 225x3@1');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.exerciseName).toBe('squat');
    expect(set.weight).toBe(225);
    expect(set.reps).toBe(3);
    expect(set.rpe).toBe(9); // RPE = 10 - RIR(1)
  });

  it('parses bodyweight exercise (no weight)', () => {
    const result = parseSetInput('pullups 10 r3');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.exerciseName).toBe('pullups');
    expect(set.weight).toBeNull();
    expect(set.reps).toBe(10);
    expect(set.rpe).toBe(7);
  });

  it('defaults to RIR 3 when no RIR provided', () => {
    const result = parseSetInput('squat 225x3');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.rpe).toBe(7); // default RIR 3 → RPE 7
  });

  it('handles RIR 0 (failure)', () => {
    const result = parseSetInput('curl 25x12 r0');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.rpe).toBe(10); // RPE = 10 - RIR(0)
  });

  it('handles decimal weights', () => {
    const result = parseSetInput('dumbbell press 22.5x10 r2');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.weight).toBe(22.5);
  });

  it('returns error for empty input', () => {
    const result = parseSetInput('');
    expect(isParseError(result)).toBe(true);
    const err = result as ParseError;
    expect(err.error).toContain('Format');
  });

  it('returns error for unparseable input', () => {
    const result = parseSetInput('just some random text');
    expect(isParseError(result)).toBe(true);
  });

  it('returns error for RIR out of range', () => {
    const result = parseSetInput('bench 80x8 r15');
    expect(isParseError(result)).toBe(true);
    const err = result as ParseError;
    expect(err.error).toContain('RIR');
    expect(err.error).toContain('0-10');
  });

  it('returns error for negative weight', () => {
    // Pattern won't match negative weight since \d doesn't match minus
    const result = parseSetInput('bench -80x8 r2');
    expect(isParseError(result)).toBe(true);
  });

  it('handles multi-word exercise names', () => {
    const result = parseSetInput('incline dumbbell bench press 30x12 r3');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.exerciseName).toBe('incline dumbbell bench press');
  });

  it('is case insensitive for r/@ notation', () => {
    const result = parseSetInput('bench 80x8 R2');
    expect(isParseError(result)).toBe(false);
    const set = result as ParsedSet;
    expect(set.rpe).toBe(8);
  });
});

describe('isParseError', () => {
  it('returns true for error objects', () => {
    expect(isParseError({ error: 'test' })).toBe(true);
  });

  it('returns false for parsed set objects', () => {
    expect(isParseError({ exerciseName: 'bench', weight: 80, reps: 8, rpe: 8 })).toBe(false);
  });
});

describe('rpeToRir', () => {
  it('converts RPE to RIR correctly', () => {
    expect(rpeToRir(10)).toBe(0);
    expect(rpeToRir(7)).toBe(3);
    expect(rpeToRir(5)).toBe(5);
  });
});

describe('formatSetDisplay', () => {
  it('formats weighted set with RIR', () => {
    expect(formatSetDisplay(80, 8, 8)).toBe('80\u00D78 r2');
  });

  it('formats bodyweight set', () => {
    expect(formatSetDisplay(null, 10, 7)).toBe('10 r3');
  });

  it('formats failure set', () => {
    expect(formatSetDisplay(100, 5, 10)).toBe('100\u00D75 r0');
  });
});
