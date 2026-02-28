export interface ParsedSet {
  exerciseName: string;
  weight: number | null;
  reps: number;
  rpe: number;
}

/**
 * Parses natural-language set input.
 *
 * Supported formats:
 *   "bench press 135x5@8"   → weight=135, reps=5, rpe=8
 *   "pullups 10@7"          → weight=null, reps=10, rpe=7
 *   "squat 225x3"           → weight=225, reps=3, rpe=7 (default)
 *   "curl 25x12@6.5"        → weight=25, reps=12, rpe=6.5
 */
const SET_PATTERN = /^(.+?)\s+(?:(\d+(?:\.\d+)?)x)?(\d+)(?:@(\d+(?:\.\d+)?))?$/i;

export function parseSetInput(input: string): ParsedSet | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(SET_PATTERN);
  if (!match) return null;

  const exerciseName = match[1].trim();
  if (!exerciseName) return null;

  const weight = match[2] != null ? parseFloat(match[2]) : null;
  const reps = parseInt(match[3], 10);
  const rpe = match[4] != null ? parseFloat(match[4]) : 7;

  if (isNaN(reps) || reps <= 0) return null;
  if (rpe < 1 || rpe > 10) return null;
  if (weight != null && weight < 0) return null;

  return { exerciseName, weight, reps, rpe };
}
