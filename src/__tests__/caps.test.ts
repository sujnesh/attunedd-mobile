import { getCapsForBand, enforceCaps } from '../engine/caps';
import type { PolicyCaps } from '../engine/types';

describe('getCapsForBand', () => {
  it('optimal band returns max RPE 10, 100% stress, no neural block, zone 5', () => {
    const caps = getCapsForBand('optimal', 1.0);
    expect(caps).toEqual({
      max_rpe: 10,
      max_allowed_stress_pct: 100,
      block_heavy_neural: false,
      max_cardio_zone: 5,
    });
  });

  it('suboptimal band returns max RPE 8, 85% stress, no neural block, zone 5', () => {
    const caps = getCapsForBand('suboptimal', 1.0);
    expect(caps).toEqual({
      max_rpe: 8,
      max_allowed_stress_pct: 85,
      block_heavy_neural: false,
      max_cardio_zone: 5,
    });
  });

  it('high_risk band returns max RPE 7, 60% stress, neural block, zone 3', () => {
    const caps = getCapsForBand('high_risk', 1.0);
    expect(caps).toEqual({
      max_rpe: 7,
      max_allowed_stress_pct: 60,
      block_heavy_neural: true,
      max_cardio_zone: 3,
    });
  });

  it('capacity < 0.75 forces high_risk regardless of band', () => {
    const caps = getCapsForBand('optimal', 0.74);
    expect(caps).toEqual({
      max_rpe: 7,
      max_allowed_stress_pct: 60,
      block_heavy_neural: true,
      max_cardio_zone: 3,
    });
  });

  it('capacity exactly 0.75 does NOT force high_risk', () => {
    const caps = getCapsForBand('optimal', 0.75);
    expect(caps.max_rpe).toBe(10);
  });

  it('capacity 0 always forces high_risk', () => {
    const caps = getCapsForBand('suboptimal', 0);
    expect(caps.block_heavy_neural).toBe(true);
    expect(caps.max_rpe).toBe(7);
  });
});

describe('enforceCaps', () => {
  const noBlock = (_name: string) => false;
  const alwaysBlock = (_name: string) => true;
  const heavyOnly = (name: string) => name === 'Deadlift' || name === 'Squat';

  const highRiskCaps: PolicyCaps = {
    max_rpe: 7,
    max_allowed_stress_pct: 60,
    block_heavy_neural: true,
    max_cardio_zone: 3,
  };

  const optimalCaps: PolicyCaps = {
    max_rpe: 10,
    max_allowed_stress_pct: 100,
    block_heavy_neural: false,
    max_cardio_zone: 5,
  };

  it('allows exercise within all caps', () => {
    const result = enforceCaps('Curl', 7, 50, 100, highRiskCaps, noBlock);
    expect(result.allowed).toBe(true);
    expect(result.violationType).toBeUndefined();
  });

  it('blocks heavy neural exercise first (enforcement order 1)', () => {
    // Even though RPE also exceeds cap, heavy_neural_block takes priority
    const result = enforceCaps('Deadlift', 9, 80, 100, highRiskCaps, heavyOnly);
    expect(result.allowed).toBe(false);
    expect(result.violationType).toBe('heavy_neural_block');
  });

  it('does not block non-heavy exercise even with block_heavy_neural', () => {
    const result = enforceCaps('Curl', 7, 30, 100, highRiskCaps, heavyOnly);
    expect(result.allowed).toBe(true);
  });

  it('blocks RPE above cap (enforcement order 2)', () => {
    const result = enforceCaps('Curl', 8, 30, 100, highRiskCaps, noBlock);
    expect(result.allowed).toBe(false);
    expect(result.violationType).toBe('rpe_cap');
  });

  it('allows RPE exactly at cap', () => {
    const result = enforceCaps('Curl', 7, 30, 100, highRiskCaps, noBlock);
    expect(result.allowed).toBe(true);
  });

  it('blocks stress above cap (enforcement order 3)', () => {
    // stress pct = (70/100)*100 = 70%, cap is 60%
    const result = enforceCaps('Curl', 6, 70, 100, highRiskCaps, noBlock);
    expect(result.allowed).toBe(false);
    expect(result.violationType).toBe('stress_cap');
  });

  it('blocks when stress exactly equals cap percentage', () => {
    // stress pct = (60/100)*100 = 60%, cap is 60% -> >= triggers
    const result = enforceCaps('Curl', 6, 60, 100, highRiskCaps, noBlock);
    expect(result.allowed).toBe(false);
    expect(result.violationType).toBe('stress_cap');
  });

  it('skips stress check when allowedStress is 0', () => {
    const result = enforceCaps('Curl', 7, 999, 0, highRiskCaps, noBlock);
    expect(result.allowed).toBe(true);
  });

  it('allows everything under optimal caps', () => {
    const result = enforceCaps('Deadlift', 10, 99, 100, optimalCaps, heavyOnly);
    expect(result.allowed).toBe(true);
  });

  it('enforcement order: heavy neural > RPE > stress', () => {
    // All three violations present — should return heavy_neural_block
    const result = enforceCaps('Squat', 9, 80, 100, highRiskCaps, heavyOnly);
    expect(result.violationType).toBe('heavy_neural_block');
  });

  it('enforcement order: RPE before stress when no neural block', () => {
    // RPE violation + stress violation, but no neural block
    const capsNoBlock: PolicyCaps = { ...highRiskCaps, block_heavy_neural: false };
    const result = enforceCaps('Squat', 9, 80, 100, capsNoBlock, heavyOnly);
    expect(result.violationType).toBe('rpe_cap');
  });
});
