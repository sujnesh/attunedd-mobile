import type { PolicyCaps, ViolationType } from '../../engine/types';
import { isHeavyNeural } from './sessionState';

export interface Deviation {
  type: ViolationType;
  message: string;
  requiresOverride: boolean;
}

export function checkDeviation(
  exerciseName: string,
  rpe: number,
  currentStress: number,
  allowedStress: number,
  caps: PolicyCaps,
): Deviation | null {
  // 1. Heavy neural block
  if (caps.block_heavy_neural && isHeavyNeural(exerciseName)) {
    return {
      type: 'heavy_neural_block',
      message: 'Heavy neural exercise blocked by current recovery state',
      requiresOverride: true,
    };
  }

  // 2. RPE cap
  if (rpe > caps.max_rpe) {
    return {
      type: 'rpe_cap',
      message: `RPE ${rpe} exceeds cap of ${caps.max_rpe}`,
      requiresOverride: true,
    };
  }

  // 3. Stress cap
  if (allowedStress > 0) {
    const currentPct = (currentStress / allowedStress) * 100;
    if (currentPct >= caps.max_allowed_stress_pct) {
      return {
        type: 'stress_cap',
        message: `Stress at ${Math.round(currentPct)}% exceeds ${caps.max_allowed_stress_pct}% cap`,
        requiresOverride: true,
      };
    }
  }

  return null;
}
