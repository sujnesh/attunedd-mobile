import type { SessionState } from './sessionState';

interface SetInput {
  exerciseName: string;
  weight: number | null;
  reps: number;
  rpe: number;
}

export interface CoachingFeedback {
  message: string;
  type: 'info' | 'warning';
}

/**
 * Generates coaching feedback after each logged set.
 * Returns null if no meaningful feedback.
 */
export function generateSetFeedback(
  session: SessionState,
  newSet: SetInput,
): CoachingFeedback | null {
  const exerciseSets = session.sets.filter(
    (s) => s.exerciseName === newSet.exerciseName,
  );

  // Anomaly: weight dramatically different from previous sets
  if (newSet.weight != null && exerciseSets.length > 0) {
    const prevWeights = exerciseSets
      .filter((s) => s.weight != null)
      .map((s) => s.weight!);
    if (prevWeights.length > 0) {
      const avgWeight = prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length;
      const ratio = newSet.weight / avgWeight;
      if (ratio > 1.5 || ratio < 0.5) {
        return {
          message: `Weight ${newSet.weight} is very different from previous sets (~${Math.round(avgWeight)}). Typo?`,
          type: 'warning',
        };
      }
    }
  }

  // Anomaly: very low RIR (high RPE) on first set — possibly mistyped
  const rir = 10 - newSet.rpe;
  if (exerciseSets.length === 0 && rir <= 1 && newSet.weight != null && newSet.weight > 50) {
    return {
      message: `RIR ${rir} on your first set — that's ${rir === 0 ? 'failure' : 'near failure'}. Starting heavy?`,
      type: 'warning',
    };
  }

  // RPE/effort trend: increasing across sets (fatigue building)
  if (exerciseSets.length >= 2) {
    const recent = exerciseSets.slice(-2);
    if (recent[0].rpe < recent[1].rpe && newSet.rpe > recent[1].rpe) {
      return {
        message: 'Effort increasing across sets. Consider dropping weight next set.',
        type: 'warning',
      };
    }
  }

  // Volume tracking: milestone feedback
  const totalSetsForExercise = exerciseSets.length + 1;
  if (totalSetsForExercise === 3) {
    return {
      message: `3 sets on ${newSet.exerciseName}. Good volume.`,
      type: 'info',
    };
  }
  if (totalSetsForExercise === 5) {
    return {
      message: `5 sets on ${newSet.exerciseName}. Consider moving to next exercise.`,
      type: 'info',
    };
  }

  // Stress budget approaching limit
  if (session.allowedStress > 0) {
    const pctAfter = ((session.cumulativeStress) / session.allowedStress) * 100;
    if (pctAfter >= 90 && pctAfter < 100) {
      return {
        message: 'Approaching stress budget limit. Wrap up soon.',
        type: 'warning',
      };
    }
  }

  // Rest time suggestion for high effort sets
  if (newSet.rpe >= 9) {
    return {
      message: 'Heavy set. Rest 2-3 min before next set.',
      type: 'info',
    };
  }

  if (newSet.rpe >= 7 && newSet.rpe < 9) {
    return {
      message: 'Rest 90s-2 min before next set.',
      type: 'info',
    };
  }

  return null;
}
