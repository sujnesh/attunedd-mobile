import type { EvaluationSnapshot } from './evaluationEngine';

export interface DeltaResult {
  shouldNotify: boolean;
  reason: string;
}

export function computeDelta(
  current: EvaluationSnapshot,
  previous: EvaluationSnapshot | null
): DeltaResult {
  if (previous === null) {
    return { shouldNotify: false, reason: '' };
  }

  if (current.risk_band !== previous.risk_band) {
    return {
      shouldNotify: true,
      reason: `Risk band changed from ${previous.risk_band} to ${current.risk_band}.`,
    };
  }

  const scoreDiff = Math.abs(current.adaptation_score - previous.adaptation_score);
  if (scoreDiff >= 8) {
    const direction = current.adaptation_score > previous.adaptation_score ? 'increased' : 'decreased';
    return {
      shouldNotify: true,
      reason: `Adaptation score ${direction} by ${scoreDiff} points to ${current.adaptation_score}.`,
    };
  }

  if (current.caps.max_rpe < previous.caps.max_rpe) {
    return {
      shouldNotify: true,
      reason: `RPE cap reduced from ${previous.caps.max_rpe} to ${current.caps.max_rpe}.`,
    };
  }

  if (current.caps.max_allowed_stress_pct < previous.caps.max_allowed_stress_pct) {
    return {
      shouldNotify: true,
      reason: `Stress cap reduced from ${previous.caps.max_allowed_stress_pct}% to ${current.caps.max_allowed_stress_pct}%.`,
    };
  }

  if (current.caps.block_heavy_neural && !previous.caps.block_heavy_neural) {
    return {
      shouldNotify: true,
      reason: 'Heavy compound lifts are now restricted due to recovery state.',
    };
  }

  return { shouldNotify: false, reason: '' };
}
