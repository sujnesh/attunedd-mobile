import type { PolicyCaps, ViolationType } from '../../engine/types';
import { isHeavyNeural } from './sessionState';
import type { OverrideState } from './overrideTracker';

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
  overrides?: OverrideState,
): Deviation | null {
  // 1. Heavy neural block — only prompt once per exercise
  if (caps.block_heavy_neural && isHeavyNeural(exerciseName)) {
    const alreadyOverridden = overrides?.overrides.some(
      (o) => o.exerciseName === exerciseName && o.violationType === 'heavy_neural_block',
    );
    if (!alreadyOverridden) {
      return {
        type: 'heavy_neural_block',
        message: 'Heavy neural exercise blocked by current recovery state',
        requiresOverride: true,
      };
    }
  }

  // 2. RPE cap
  if (rpe > caps.max_rpe) {
    return {
      type: 'rpe_cap',
      message: `RIR ${10 - rpe} exceeds minimum RIR cap of ${10 - caps.max_rpe}`,
      requiresOverride: true,
    };
  }

  // 3. Stress cap — only prompt once when first exceeded
  if (allowedStress > 0) {
    const currentPct = (currentStress / allowedStress) * 100;
    if (currentPct >= caps.max_allowed_stress_pct) {
      const alreadyOverriddenStress = overrides?.overrides.some(
        (o) => o.violationType === 'stress_cap',
      );
      if (!alreadyOverriddenStress) {
        return {
          type: 'stress_cap',
          message: `Stress budget exceeded — consider finishing`,
          requiresOverride: true,
        };
      }
    }
  }

  return null;
}
