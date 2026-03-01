import { checkDeviation } from '../workout/core/deviationEngine';
import type { PolicyCaps } from '../engine/types';

const CAPS: PolicyCaps = {
  max_rpe: 8,
  max_allowed_stress_pct: 85,
  block_heavy_neural: false,
  max_cardio_zone: 3,
};

describe('checkDeviation', () => {
  it('returns null when no violations', () => {
    const result = checkDeviation('bench press', 7, 50, 100, CAPS);
    expect(result).toBeNull();
  });

  it('detects RPE cap violation', () => {
    const result = checkDeviation('bench press', 9, 50, 100, CAPS);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('rpe_cap');
    expect(result!.message).toContain('RIR');
    expect(result!.requiresOverride).toBe(true);
  });

  it('allows RPE at exactly the cap', () => {
    const result = checkDeviation('bench press', 8, 50, 100, CAPS);
    expect(result).toBeNull();
  });

  it('detects stress cap violation', () => {
    const result = checkDeviation('curl', 7, 90, 100, CAPS);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('stress_cap');
    expect(result!.message).toContain('Stress budget exceeded');
    expect(result!.requiresOverride).toBe(true);
  });

  it('allows stress below cap', () => {
    const result = checkDeviation('curl', 7, 80, 100, CAPS);
    expect(result).toBeNull();
  });

  it('skips stress check when allowedStress is 0', () => {
    const result = checkDeviation('curl', 7, 100, 0, CAPS);
    expect(result).toBeNull();
  });

  it('detects heavy neural block when caps enforce it', () => {
    const blockedCaps: PolicyCaps = { ...CAPS, block_heavy_neural: true };
    const result = checkDeviation('deadlift', 6, 0, 100, blockedCaps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('heavy_neural_block');
    expect(result!.requiresOverride).toBe(true);
  });

  it('allows non-heavy exercises when neural block is on', () => {
    const blockedCaps: PolicyCaps = { ...CAPS, block_heavy_neural: true };
    const result = checkDeviation('curl', 7, 0, 100, blockedCaps);
    expect(result).toBeNull();
  });

  it('prioritizes heavy neural block over RPE cap', () => {
    const blockedCaps: PolicyCaps = { ...CAPS, block_heavy_neural: true };
    const result = checkDeviation('squat', 9, 90, 100, blockedCaps);
    expect(result!.type).toBe('heavy_neural_block');
  });
});
