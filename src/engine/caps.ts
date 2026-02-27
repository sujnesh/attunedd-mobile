import type { PolicyCaps, RiskBand, ViolationType, EnforcementResult } from './types';

/**
 * Mirrors: CoachPolicyEngine#compute_caps (app/services/coach_policy_engine.rb:182-193)
 *
 * If capacityScore < 0.75, forces high_risk regardless of band.
 */
export function getCapsForBand(
  band: RiskBand,
  capacityScore: number,
): PolicyCaps {
  const effectiveBand: RiskBand = capacityScore < 0.75 ? 'high_risk' : band;

  switch (effectiveBand) {
    case 'optimal':
      return {
        max_rpe: 10,
        max_allowed_stress_pct: 100,
        block_heavy_neural: false,
        max_cardio_zone: 5,
      };
    case 'suboptimal':
      return {
        max_rpe: 8,
        max_allowed_stress_pct: 85,
        block_heavy_neural: false,
        max_cardio_zone: 5,
      };
    case 'high_risk':
      return {
        max_rpe: 7,
        max_allowed_stress_pct: 60,
        block_heavy_neural: true,
        max_cardio_zone: 3,
      };
  }
}

/**
 * Mirrors: PolicyEnforcer.check (app/services/policy_enforcer.rb:4-41)
 *
 * Enforcement order:
 *   1. Heavy neural block
 *   2. RPE cap
 *   3. Stress cap (only if allowedStress > 0)
 *
 * Returns first violation found.
 */
export function enforceCaps(
  exerciseName: string,
  rpe: number,
  actualStress: number,
  allowedStress: number,
  caps: PolicyCaps,
  isHeavyNeural: (name: string) => boolean,
): EnforcementResult {
  // 1. Heavy Neural Block
  if (caps.block_heavy_neural && isHeavyNeural(exerciseName)) {
    return { allowed: false, violationType: 'heavy_neural_block' };
  }

  // 2. RPE Cap
  if (rpe > caps.max_rpe) {
    return { allowed: false, violationType: 'rpe_cap' };
  }

  // 3. Stress Cap
  if (allowedStress > 0) {
    const currentPct = (actualStress / allowedStress) * 100.0;
    if (currentPct >= caps.max_allowed_stress_pct) {
      return { allowed: false, violationType: 'stress_cap' };
    }
  }

  return { allowed: true };
}
