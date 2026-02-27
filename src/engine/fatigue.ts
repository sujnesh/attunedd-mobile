import type { SetData } from './types';
import { midpointReps } from './stress';

/**
 * Mirrors: SessionControllerService#detect_fatigue (app/services/session_controller_service.rb:130-156)
 *
 * Triggers when last 2 sets BOTH have:
 *   rpe >= plannedRpe + 1
 *   reps < plannedMidReps
 *
 * recentSets: ordered newest-first (desc by set_number), length >= 2
 * plannedRpe: defaults to 7.0 if 0
 */
export function detectPlannedFatigue(
  recentSets: SetData[],
  plannedRpe: number,
  plannedRepRange: string,
): boolean {
  if (recentSets.length < 2) {
    return false;
  }

  const effectiveRpe = plannedRpe === 0 ? 7.0 : plannedRpe;
  const plannedMidReps = midpointReps(plannedRepRange);

  const last2 = recentSets.slice(0, 2);

  return last2.every(
    (set) => set.rpe >= effectiveRpe + 1 && set.reps < plannedMidReps,
  );
}

/**
 * Mirrors: FreeFormSessionService#detect_fatigue (app/services/free_form_session_service.rb:40-58)
 *
 * Triggers when:
 *   last 2 sets BOTH have rpe >= 9
 *   reps decreasing (newer.reps < older.reps)
 *
 * recentSets: ordered newest-first (desc by set_number), length >= 2
 */
export function detectFreeFormFatigue(recentSets: SetData[]): boolean {
  if (recentSets.length < 2) {
    return false;
  }

  const newer = recentSets[0];
  const older = recentSets[1];

  const bothHighRpe = newer.rpe >= 9 && older.rpe >= 9;
  if (!bothHighRpe) {
    return false;
  }

  return newer.reps < older.reps;
}
