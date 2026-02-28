import AppleHealthKit, {
  type HealthInputOptions,
  type HealthValue,
} from 'react-native-health';
import type { RawActivity } from './types';

const PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [],
  },
};

export async function initAppleHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      resolve(!err);
    });
  });
}

export async function fetchRecentRuns(
  lookbackDays: number = 7
): Promise<RawActivity[]> {
  const startDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const options: HealthInputOptions = {
    startDate,
  };

  const samples = await getSamples(options);
  const activities: RawActivity[] = [];

  for (const sample of samples) {
    const startMs = new Date((sample as any).start ?? sample.startDate).getTime();
    const endMs = new Date((sample as any).end ?? sample.endDate).getTime();
    const durationMinutes = (endMs - startMs) / 60000;

    if (durationMinutes <= 0) continue;

    const avgHr = await getAverageHeartRate(
      (sample as any).start ?? sample.startDate,
      (sample as any).end ?? sample.endDate
    );

    activities.push({
      source: 'apple',
      start_time: startMs,
      duration_minutes: durationMinutes,
      distance_m: (sample as any).distance ? (sample as any).distance * 1000 : null,
      avg_hr: avgHr,
      max_hr: null,
      calories: (sample as any).calories ?? null,
      activity_type: 'running',
      raw_json: JSON.stringify(sample),
    });
  }

  return activities;
}

function getSamples(
  options: HealthInputOptions
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    AppleHealthKit.getSamples(options, (err: string, results: HealthValue[]) => {
      if (err) {
        reject(new Error(err));
        return;
      }
      resolve(results || []);
    });
  });
}

function getAverageHeartRate(
  startDate: string,
  endDate: string
): Promise<number | null> {
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(
      { startDate, endDate },
      (err: string, results: Array<{ value: number }>) => {
        if (err || !results || results.length === 0) {
          resolve(null);
          return;
        }
        const sum = results.reduce((acc, r) => acc + r.value, 0);
        resolve(sum / results.length);
      }
    );
  });
}
