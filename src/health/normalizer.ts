import type { RawActivity, NormalizedActivity } from './types';

const ZONE_INTENSITY: Record<number, number> = {
  2: 1.0,
  3: 1.4,
  4: 1.8,
  5: 1.8,
};

const CARDIO_MULTIPLIER = 1.1;

export function deriveZone(avgHr: number | null, userAge: number): number {
  if (avgHr === null || avgHr <= 0 || userAge <= 0) {
    return 2;
  }

  const estimatedMaxHR = 220 - userAge;
  if (estimatedMaxHR <= 0) {
    return 2;
  }

  const hrPercent = avgHr / estimatedMaxHR;

  if (hrPercent < 0.7) return 2;
  if (hrPercent < 0.8) return 3;
  if (hrPercent < 0.9) return 4;
  return 5;
}

export function calculateCardioAsu(durationMinutes: number, zone: number): number {
  const intensity = ZONE_INTENSITY[zone] ?? 1.0;
  const asu = durationMinutes * intensity * CARDIO_MULTIPLIER;
  return Math.min(Math.max(asu, 0.0), 120.0);
}

export function normalizeActivity(
  raw: RawActivity,
  userAge: number
): NormalizedActivity {
  const derived_zone = deriveZone(raw.avg_hr, userAge);
  const computed_asu = calculateCardioAsu(raw.duration_minutes, derived_zone);

  return {
    source: raw.source,
    start_time: raw.start_time,
    duration_minutes: raw.duration_minutes,
    distance_m: raw.distance_m,
    avg_hr: raw.avg_hr,
    derived_zone,
    computed_asu,
    raw_json: raw.raw_json,
  };
}
