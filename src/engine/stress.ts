/**
 * Mirrors: StressCalculator.set_stress (app/services/stress_calculator.rb:13)
 *
 * Formula: weight * reps * (1 + (10 - rpe) * 0.05)
 */
export function calculateStrengthStress(
  weight: number,
  reps: number,
  rpe: number,
): number {
  return weight * reps * (1 + (10 - rpe) * 0.05);
}

/**
 * Mirrors: session_controller_service.rb:66-68
 *
 * Bodyweight fallback: reps * rpe
 */
export function calculateBodyweightStress(
  reps: number,
  rpe: number,
): number {
  return reps * rpe;
}

/**
 * Mirrors: backend branching in session_controller_service.rb:60-68
 * and workout_log_sets_controller.rb:90-95
 *
 * If weight is present AND > 0:
 *   weight * reps * (1 + (10 - rpe) * 0.05)
 * Else:
 *   reps * rpe
 */
export function calculateStress(
  weight: number | null,
  reps: number,
  rpe: number,
): number {
  if (weight != null && weight > 0) {
    return calculateStrengthStress(weight, reps, rpe);
  }
  return calculateBodyweightStress(reps, rpe);
}

/**
 * Mirrors: StressCalculator.midpoint_reps (app/services/stress_calculator.rb:72-81)
 *
 * Ruby parity: "segment".to_i returns 0 for non-numeric strings.
 * parseInt("") returns NaN; we convert NaN to 0 to match Ruby's to_i.
 *
 * Rules:
 * - blank → 10
 * - "8-10" → (8 + 10) / 2
 * - single value → value
 * - value = 0 → 10
 */
export function midpointReps(repRange: string | null | undefined): number {
  if (repRange == null || repRange.trim() === '') {
    return 10;
  }

  const parts = repRange
    .toString()
    .split('-')
    .map((p) => {
      const n = parseInt(p, 10);
      return isNaN(n) ? 0 : n;
    });

  if (parts.length === 2) {
    return (parts[0] + parts[1]) / 2.0;
  }

  return parts[0] === 0 ? 10 : parts[0];
}
