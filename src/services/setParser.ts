export interface ParsedSet {
  exerciseName: string;
  weight: number | null;
  reps: number;
  rpe: number; // Internal: always RPE (10 - rir) for backend compatibility
}

export interface ParseError {
  error: string;
}

export type ParseResult = ParsedSet | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return 'error' in result;
}

/**
 * Parses natural-language set input using RIR (Reps in Reserve).
 *
 * Supported formats:
 *   "bench press 80x8 r2"     → weight=80, reps=8, rir=2 (rpe=8)
 *   "bench press 80x8@2"      → same (@ treated as RIR)
 *   "pullups 10 r3"            → weight=null, reps=10, rir=3 (rpe=7)
 *   "squat 225x3"              → weight=225, reps=3, rir=3 (default, rpe=7)
 *   "curl 25x12 r0"            → weight=25, reps=12, rir=0 (failure, rpe=10)
 *
 * RIR scale:
 *   0 = failure (couldn't do one more)
 *   1 = could do 1 more
 *   2 = could do 2 more
 *   3 = standard training zone
 *   4+ = easy / warm-up
 */
const SET_PATTERN = /^(.+?)\s+(?:(\d+(?:\.\d+)?)x)?(\d+)(?:\s*(?:r|@)(\d+(?:\.\d+)?))?$/i;

export function parseSetInput(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: 'Format: exercise weight\u00D7reps r{RIR}. Example: bench press 80x8 r2' };
  }

  const match = trimmed.match(SET_PATTERN);
  if (!match) {
    return { error: 'Format: exercise weight\u00D7reps r{RIR}. Example: curl 25x12 r3' };
  }

  const exerciseName = match[1].trim();
  if (!exerciseName) {
    return { error: 'Missing exercise name. Example: bench press 80x8 r2' };
  }

  const weight = match[2] != null ? parseFloat(match[2]) : null;
  const reps = parseInt(match[3], 10);
  const rir = match[4] != null ? parseFloat(match[4]) : 3; // default RIR 3

  if (isNaN(reps) || reps <= 0) {
    return { error: 'Reps must be a positive number.' };
  }

  if (rir < 0 || rir > 10) {
    return { error: 'RIR is reps left in the tank. 0 = failure, 3 = could do 3 more. Range: 0-10.' };
  }

  if (weight != null && weight < 0) {
    return { error: 'Weight cannot be negative.' };
  }

  // Convert RIR to RPE for backend: RPE = 10 - RIR
  const rpe = 10 - rir;

  return { exerciseName, weight, reps, rpe };
}

/** Convert an internal RPE value to RIR for display */
export function rpeToRir(rpe: number): number {
  return 10 - rpe;
}

/** Format a set for display using RIR notation */
export function formatSetDisplay(weight: number | null, reps: number, rpe: number): string {
  const rir = rpeToRir(rpe);
  const weightPart = weight != null ? `${weight}\u00D7` : '';
  return `${weightPart}${reps} r${rir}`;
}
