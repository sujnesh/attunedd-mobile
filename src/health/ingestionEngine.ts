import { Platform } from 'react-native';
import { executeSql, generateUUID, nowISO } from '../db/database';
import { enqueueEvent } from '../sync/eventQueue';
import { flushQueue } from '../sync/syncEngine';
import { normalizeActivity } from './normalizer';
import { generateActivityHash } from './dedup';
import { EVENT_TYPES } from '../sync/eventTypes';
import { getMeta, setMeta } from '../services/metaStateService';
import type { RawActivity } from './types';
import type { IngestExternalActivityPayload, SyncHealthVitalsPayload } from '../sync/eventTypes';

export async function ingestDeviceActivities(
  userAge: number,
  authToken: string
): Promise<{ ingested: number; skipped: number }> {
  let needsFlush = false;
  let ingested = 0;
  let skipped = 0;

  try {
    const [unsyncedResults] = await executeSql(
      `SELECT * FROM external_activities WHERE synced_flag = 0;`
    );

    for (let i = 0; i < unsyncedResults.rows.length; i++) {
      const row = unsyncedResults.rows.item(i);

      const [pendingResults] = await executeSql(
        `SELECT 1 FROM sync_queue WHERE type = ? AND external_activity_hash = ? LIMIT 1;`,
        [EVENT_TYPES.INGEST_EXTERNAL_ACTIVITY, row.activity_hash]
      );

      if (pendingResults.rows.length > 0) continue;

      const deviceId = await getDeviceId();
      const appVersion = await getAppVersion();

      const startDate = new Date(row.start_time);
      const endMs = row.start_time + row.duration_minutes * 60 * 1000;
      const endDate = new Date(endMs);

      // Parse raw_json to get actual activity_type and calories
      let actType = 'workout';
      let cal: number | null = null;
      try {
        const rawData = JSON.parse(row.raw_json || '{}');
        actType = rawData.activity_type || rawData.activityName || 'workout';
        cal = rawData.calories ?? null;
      } catch { /* ignore */ }

      const payload: IngestExternalActivityPayload = {
        source: row.source,
        activity_type: actType,
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        strain: row.computed_asu,
        average_hr: row.avg_hr,
        max_hr: null,
        calories: cal,
        external_id: row.activity_hash,
        external_activity_hash: row.activity_hash,
      };

      await enqueueEvent({
        id: generateUUID(),
        type: EVENT_TYPES.INGEST_EXTERNAL_ACTIVITY,
        created_at: Date.now(),
        payload,
        device_id: deviceId,
        app_version: appVersion,
      });

      needsFlush = true;
    }

    const rawActivities = await fetchPlatformActivities();

    for (const raw of rawActivities) {
      const normalized = normalizeActivity(raw, userAge);
      const hash = generateActivityHash(normalized);

      const now = nowISO();

      const [insertResult] = await executeSql(
        `INSERT OR IGNORE INTO external_activities
           (source, activity_hash, start_time, duration_minutes, distance_m,
            avg_hr, derived_zone, computed_asu, raw_json, synced_flag,
            updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [
          normalized.source,
          hash,
          normalized.start_time,
          normalized.duration_minutes,
          normalized.distance_m,
          normalized.avg_hr,
          normalized.derived_zone,
          normalized.computed_asu,
          normalized.raw_json,
          now,
          now,
        ]
      );

      if (insertResult.rowsAffected === 0) {
        skipped++;
        continue;
      }

      const deviceId = await getDeviceId();
      const appVersion = await getAppVersion();

      const startDate = new Date(normalized.start_time);
      const endMs =
        normalized.start_time + normalized.duration_minutes * 60 * 1000;
      const endDate = new Date(endMs);

      const payload: IngestExternalActivityPayload = {
        source: normalized.source,
        activity_type: raw.activity_type,
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        strain: normalized.computed_asu,
        average_hr: normalized.avg_hr,
        max_hr: raw.max_hr,
        calories: raw.calories,
        external_id: hash,
        external_activity_hash: hash,
      };

      await enqueueEvent({
        id: generateUUID(),
        type: EVENT_TYPES.INGEST_EXTERNAL_ACTIVITY,
        created_at: Date.now(),
        payload,
        device_id: deviceId,
        app_version: appVersion,
      });

      ingested++;
    }

    if (ingested > 0 || needsFlush) {
      await flushQueue(authToken);
    }

    // Persist ingestion diagnostics
    await setMeta('last_ingest_time', new Date().toISOString());
    await setMeta('last_ingest_result_json', JSON.stringify({ ingested, skipped }));

    return { ingested, skipped };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    await setMeta('last_health_error', message).catch(() => {});
    throw error;
  }
}

export async function markActivitySynced(activityHash: string): Promise<void> {
  await executeSql(
    `UPDATE external_activities SET synced_flag = 1, updated_at = ? WHERE activity_hash = ?;`,
    [nowISO(), activityHash]
  );
}

async function fetchPlatformActivities(): Promise<RawActivity[]> {
  if (Platform.OS === 'ios') {
    const { fetchAllWorkouts } = await import('./appleHealth');
    return fetchAllWorkouts(30);
  } else {
    const { fetchRecentRuns } = await import('./healthConnect');
    return fetchRecentRuns();
  }
}

/**
 * Sync health vitals (sleep, steps, HR, HRV, weight) to the backend.
 * Called after ingestion so the server has data for coaching.
 */
export async function syncHealthVitals(authToken: string): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // Only sync once per day
  const today = new Date().toISOString().slice(0, 10);
  const lastSync = await getMeta('last_vitals_sync_date');
  if (lastSync === today) return;

  try {
    const {
      fetchSleepData,
      fetchDailySteps,
      fetchRestingHeartRate,
      fetchHRV,
      fetchActiveEnergy,
      fetchLatestWeight,
    } = await import('./appleHealth');

    const [sleep, steps, rhr, hrvData, energy, weight] = await Promise.all([
      fetchSleepData(7),
      fetchDailySteps(7),
      fetchRestingHeartRate(7),
      fetchHRV(7),
      fetchActiveEnergy(1),
      fetchLatestWeight(),
    ]);

    const latestRHR = rhr.length > 0 ? Math.round(rhr[rhr.length - 1].value) : null;
    const latestHRV = hrvData.length > 0 ? Math.round(hrvData[hrvData.length - 1].value) : null;
    const todayCals = energy.length > 0 ? Math.round(energy.reduce((s, e) => s + e.value, 0)) : null;
    const todaySteps = steps.length > 0 ? steps[steps.length - 1]?.value ?? null : null;

    // Compute sleep hours from last night
    let sleepHours: number | null = null;
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    let totalMs = 0;
    for (const s of sleep) {
      const val = (s.value || '').toUpperCase();
      if (val === 'INBED' || val === 'AWAKE') continue;
      const end = new Date(s.endDate).getTime();
      if (end < yesterday) continue;
      totalMs += end - new Date(s.startDate).getTime();
    }
    if (totalMs > 0) sleepHours = totalMs / (1000 * 60 * 60);

    const payload: SyncHealthVitalsPayload = {
      date: today,
      resting_hr: latestRHR,
      hrv: latestHRV,
      active_calories: todayCals,
      steps: todaySteps,
      sleep_hours: sleepHours,
      weight_kg: weight,
      sleep_samples: sleep.map(s => ({
        start: s.startDate,
        end: s.endDate,
        value: s.value,
      })),
      step_samples: steps.map(s => ({
        date: s.startDate,
        value: s.value,
      })),
    };

    const deviceId = await getDeviceId();
    const appVersion = await getAppVersion();

    await enqueueEvent({
      id: generateUUID(),
      type: EVENT_TYPES.SYNC_HEALTH_VITALS,
      created_at: Date.now(),
      payload,
      device_id: deviceId,
      app_version: appVersion,
    });

    await flushQueue(authToken);
    await setMeta('last_vitals_sync_date', today);
  } catch {
    // non-fatal — will retry next time
  }
}

async function getDeviceId(): Promise<string> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'device_id';`
  );
  if (results.rows.length > 0) {
    return results.rows.item(0).value;
  }
  const id = generateUUID();
  await executeSql(
    `INSERT INTO meta_state (key, value) VALUES ('device_id', ?);`,
    [id]
  );
  return id;
}

async function getAppVersion(): Promise<string> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'app_version';`
  );
  if (results.rows.length > 0) {
    return results.rows.item(0).value;
  }
  return '1.0.0';
}
