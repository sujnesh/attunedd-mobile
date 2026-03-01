import { NativeModules, Platform } from 'react-native';
import type { RawActivity } from './types';

const RNHealth: any = NativeModules.AppleHealthKit;

// Request broad permissions so we can read everything useful
const PERMISSIONS = {
  permissions: {
    read: [
      'Workout',
      'HeartRate',
      'RestingHeartRate',
      'HeartRateVariability',
      'StepCount',
      'DistanceWalkingRunning',
      'DistanceCycling',
      'DistanceSwimming',
      'ActiveEnergyBurned',
      'BasalEnergyBurned',
      'SleepAnalysis',
      'Weight',
      'BodyFatPercentage',
      'Vo2Max',
      'OxygenSaturation',
      'FlightsClimbed',
      'AppleExerciseTime',
    ],
    write: [] as string[],
  },
};

function assertNativeModule(): void {
  if (!RNHealth) {
    const available = Object.keys(NativeModules).join(', ');
    throw new Error(
      `AppleHealthKit native module not found. Available: [${available}].`,
    );
  }
}

export type PermissionStatus = 'granted' | 'denied' | 'not_determined' | 'unavailable';

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS !== 'ios' || !RNHealth) return 'unavailable';
  try {
    const isAvailable = await new Promise<boolean>((resolve) => {
      RNHealth.isAvailable((err: any, available: boolean) => {
        resolve(!err && available);
      });
    });
    if (!isAvailable) return 'unavailable';
    return 'not_determined';
  } catch {
    return 'not_determined';
  }
}

export async function initAppleHealth(): Promise<boolean> {
  assertNativeModule();
  return new Promise((resolve, reject) => {
    try {
      RNHealth.initHealthKit(PERMISSIONS, (err: any) => {
        if (err) {
          reject(new Error(`HealthKit init failed: ${JSON.stringify(err)}`));
          return;
        }
        resolve(true);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ---------------------------------------------------------------------------
// Workouts — fetch ALL types (running, strength, cycling, swimming, yoga, etc.)
// ---------------------------------------------------------------------------

interface AnchoredWorkout {
  activityId: number;
  activityName: string;
  calories: number;
  distance: number; // miles
  start: string;
  end: string;
  duration: number; // seconds
  id: string;
  tracked: boolean;
  sourceName: string;
  device: string;
}

export async function fetchAllWorkouts(
  lookbackDays: number = 30,
): Promise<RawActivity[]> {
  if (!RNHealth) return [];

  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const result = await new Promise<{ data: AnchoredWorkout[]; anchor: string }>(
    (resolve, reject) => {
      RNHealth.getAnchoredWorkouts(
        { startDate },
        (err: any, res: any) => {
          if (err) {
            reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
            return;
          }
          resolve(res);
        },
      );
    },
  );

  const workouts = result.data || [];
  const activities: RawActivity[] = [];

  for (const w of workouts) {
    const startMs = new Date(w.start).getTime();
    const endMs = new Date(w.end).getTime();
    const durationMinutes = w.duration > 0 ? w.duration / 60 : (endMs - startMs) / 60000;

    if (durationMinutes <= 0) continue;

    // Get average HR for this workout's time window
    const avgHr = await getAverageHeartRate(w.start, w.end);

    activities.push({
      source: 'apple',
      start_time: startMs,
      duration_minutes: durationMinutes,
      distance_m: w.distance > 0 ? w.distance * 1609.34 : null, // miles → meters
      avg_hr: avgHr,
      max_hr: null,
      calories: w.calories > 0 ? w.calories : null,
      activity_type: mapActivityType(w.activityName),
      raw_json: JSON.stringify(w),
    });
  }

  return activities;
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface SleepSample {
  startDate: string;
  endDate: string;
  value: string; // 'INBED', 'ASLEEP', 'AWAKE', 'CORE', 'DEEP', 'REM'
}

export async function fetchSleepData(
  lookbackDays: number = 7,
): Promise<SleepSample[]> {
  if (!RNHealth) return [];
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return new Promise((resolve) => {
    RNHealth.getSleepSamples(
      { startDate },
      (err: any, results: SleepSample[]) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Daily steps
// ---------------------------------------------------------------------------

export interface StepSample {
  startDate: string;
  endDate: string;
  value: number;
}

export async function fetchDailySteps(
  lookbackDays: number = 7,
): Promise<StepSample[]> {
  if (!RNHealth) return [];
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return new Promise((resolve) => {
    RNHealth.getDailyStepCountSamples(
      { startDate },
      (err: any, results: StepSample[]) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Resting heart rate
// ---------------------------------------------------------------------------

export async function fetchRestingHeartRate(
  lookbackDays: number = 7,
): Promise<Array<{ startDate: string; value: number }>> {
  if (!RNHealth) return [];
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return new Promise((resolve) => {
    RNHealth.getRestingHeartRateSamples(
      { startDate },
      (err: any, results: Array<{ startDate: string; value: number }>) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Heart rate variability (SDNN)
// ---------------------------------------------------------------------------

export async function fetchHRV(
  lookbackDays: number = 7,
): Promise<Array<{ startDate: string; value: number }>> {
  if (!RNHealth) return [];
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return new Promise((resolve) => {
    RNHealth.getHeartRateVariabilitySamples(
      { startDate },
      (err: any, results: Array<{ startDate: string; value: number }>) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Active energy burned (daily)
// ---------------------------------------------------------------------------

export async function fetchActiveEnergy(
  lookbackDays: number = 7,
): Promise<Array<{ startDate: string; endDate: string; value: number }>> {
  if (!RNHealth) return [];
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return new Promise((resolve) => {
    RNHealth.getActiveEnergyBurned(
      { startDate },
      (err: any, results: Array<{ startDate: string; endDate: string; value: number }>) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Latest weight
// ---------------------------------------------------------------------------

export async function fetchLatestWeight(): Promise<number | null> {
  if (!RNHealth) return null;
  return new Promise((resolve) => {
    RNHealth.getLatestWeight(
      { unit: 'kg' },
      (err: any, result: { value: number }) => {
        if (err || !result) {
          resolve(null);
          return;
        }
        resolve(result.value ?? null);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAverageHeartRate(
  startDate: string,
  endDate: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    RNHealth.getHeartRateSamples(
      { startDate, endDate },
      (err: string, results: Array<{ value: number }>) => {
        if (err || !results || results.length === 0) {
          resolve(null);
          return;
        }
        const sum = results.reduce((acc, r) => acc + r.value, 0);
        resolve(Math.round(sum / results.length));
      },
    );
  });
}

// Map HealthKit activity names to simpler categories
function mapActivityType(activityName: string): string {
  const name = activityName.toLowerCase();
  if (name.includes('running') || name.includes('jogging')) return 'running';
  if (name.includes('walking') || name.includes('hiking')) return 'walking';
  if (name.includes('cycling') || name.includes('biking')) return 'cycling';
  if (name.includes('swimming')) return 'swimming';
  if (name.includes('yoga') || name.includes('pilates')) return 'yoga';
  if (name.includes('strength') || name.includes('weight') || name.includes('functional')) return 'strength';
  if (name.includes('cross') || name.includes('hiit') || name.includes('high intensity')) return 'hiit';
  if (name.includes('rowing') || name.includes('elliptical') || name.includes('stair')) return 'cardio';
  if (name.includes('dance') || name.includes('aerobics')) return 'cardio';
  if (name.includes('basketball') || name.includes('soccer') || name.includes('tennis') || name.includes('football') || name.includes('rugby')) return 'sport';
  if (name.includes('boxing') || name.includes('martial') || name.includes('kickboxing')) return 'combat';
  if (name.includes('flexibility') || name.includes('stretching') || name.includes('cooldown')) return 'flexibility';
  if (name.includes('core')) return 'core';
  if (name.includes('mind') || name.includes('meditation')) return 'mindfulness';
  return activityName.toLowerCase().replace(/\s+/g, '_');
}

// Keep for backwards compat — ingestion engine calls this
export async function fetchRecentRuns(
  lookbackDays: number = 30,
): Promise<RawActivity[]> {
  return fetchAllWorkouts(lookbackDays);
}
