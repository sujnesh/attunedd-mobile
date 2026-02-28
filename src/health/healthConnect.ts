import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import type { RawActivity } from './types';

export async function initHealthConnect(): Promise<boolean> {
  try {
    const initialized = await initialize();
    if (!initialized) return false;

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'Distance' },
    ]);

    return granted.length > 0;
  } catch {
    return false;
  }
}

export async function fetchRecentRuns(
  lookbackDays: number = 7
): Promise<RawActivity[]> {
  const startTime = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const endTime = new Date().toISOString();

  const result = await readRecords('ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime, endTime },
  });

  const sessions = (result as any).records ?? result;
  const activities: RawActivity[] = [];

  for (const session of sessions) {
    if (session.exerciseType !== 56 && session.exerciseType !== 79) {
      // 56 = RUNNING, 79 = RUNNING_TREADMILL
      continue;
    }

    const sessionStart = new Date(session.startTime).getTime();
    const sessionEnd = new Date(session.endTime).getTime();
    const durationMinutes = (sessionEnd - sessionStart) / 60000;

    if (durationMinutes <= 0) continue;

    const avgHr = await getAverageHeartRate(session.startTime, session.endTime);
    const distanceM = await getTotalDistance(session.startTime, session.endTime);

    activities.push({
      source: 'health_connect',
      start_time: sessionStart,
      duration_minutes: durationMinutes,
      distance_m: distanceM,
      avg_hr: avgHr,
      max_hr: null,
      calories: null,
      activity_type: 'running',
      raw_json: JSON.stringify(session),
    });
  }

  return activities;
}

async function getAverageHeartRate(
  startTime: string,
  endTime: string
): Promise<number | null> {
  try {
    const result = await readRecords('HeartRate', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    });

    const records = (result as any).records ?? result;
    if (!records || records.length === 0) return null;

    let total = 0;
    let count = 0;
    for (const record of records) {
      for (const sample of record.samples) {
        total += sample.beatsPerMinute;
        count++;
      }
    }

    return count > 0 ? total / count : null;
  } catch {
    return null;
  }
}

async function getTotalDistance(
  startTime: string,
  endTime: string
): Promise<number | null> {
  try {
    const result = await readRecords('Distance', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    });

    const records = (result as any).records ?? result;
    if (!records || records.length === 0) return null;

    let totalM = 0;
    for (const record of records) {
      totalM += record.distance.inMeters;
    }

    return totalM > 0 ? totalM : null;
  } catch {
    return null;
  }
}
