import { executeSql } from '../db/database';
import type { SyncResponse } from '../types/api';
import {
  getPendingEvents,
  markEventSynced,
  incrementRetry,
} from './eventQueue';
import { applyAuthoritativeState } from './reconciliation';
import { EVENT_TYPES } from './eventTypes';
import { API_BASE_URL } from '../config';

const EVENTS_ENDPOINT = `${API_BASE_URL}/api/mobile/events`;

export interface FlushResult {
  sent: number;
  accepted: number;
  rejected: number;
  failed: number;
}

let isFlushing = false;

export async function flushQueue(authToken: string): Promise<FlushResult> {
  if (isFlushing) {
    return { sent: 0, accepted: 0, rejected: 0, failed: 0 };
  }
  isFlushing = true;

  const result: FlushResult = { sent: 0, accepted: 0, rejected: 0, failed: 0 };

  try {
    const events = await getPendingEvents();
    if (events.length === 0) {
      return result;
    }

    const deviceId = await getDeviceId();

    for (const event of events) {
      result.sent++;

      const syncVersion = await getSyncVersion();

      let response: Response;
      try {
        response = await fetch(EVENTS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'Idempotency-Key': event.event_id,
            'X-Device-ID': deviceId,
            'X-Sync-Version': String(syncVersion),
          },
          body: JSON.stringify({
            event_type: event.type,
            payload: JSON.parse(event.payload),
            timestamp: event.created_at,
          }),
        });
      } catch {
        await incrementRetry(event.event_id);
        result.failed++;
        break;
      }

      if (response.ok) {
        const body: SyncResponse = await response.json();

        if (body.authoritative_state) {
          const mobileLocalId = extractMobileLocalId(event.payload);
          await applyAuthoritativeState(body.authoritative_state, mobileLocalId);
        }

        if (body.sync_version) {
          await setSyncVersion(body.sync_version);
        }

        if (event.type === EVENT_TYPES.INGEST_EXTERNAL_ACTIVITY) {
          await markExternalActivitySynced(event.payload);
        }

        await markEventSynced(event.event_id);
        result.accepted++;
      } else if (response.status >= 400 && response.status < 500) {
        try {
          const body: SyncResponse = await response.json();

          if (body.authoritative_state) {
            const mobileLocalId = extractMobileLocalId(event.payload);
            await applyAuthoritativeState(body.authoritative_state, mobileLocalId);
          }

          if (body.sync_version) {
            await setSyncVersion(body.sync_version);
          }
        } catch {
          // Response body not parseable — still remove the rejected event
        }

        await markEventSynced(event.event_id);
        result.rejected++;
      } else {
        await incrementRetry(event.event_id);
        result.failed++;
        break;
      }
    }

    await setLastSyncAt(new Date().toISOString());

    return result;
  } finally {
    isFlushing = false;
  }
}

function extractMobileLocalId(payloadJson: string): string | null {
  try {
    const payload = JSON.parse(payloadJson);
    return payload.workout_log_id || payload.mobile_local_id || null;
  } catch {
    return null;
  }
}

async function getDeviceId(): Promise<string> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'device_id';`
  );
  if (results.rows.length > 0) {
    return results.rows.item(0).value;
  }

  const { generateUUID } = await import('../db/database');
  const id = generateUUID();
  await executeSql(
    `INSERT INTO meta_state (key, value) VALUES ('device_id', ?);`,
    [id]
  );
  return id;
}

async function getSyncVersion(): Promise<number> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'sync_version';`
  );
  if (results.rows.length > 0) {
    return parseInt(results.rows.item(0).value, 10) || 0;
  }
  return 0;
}

async function setSyncVersion(version: number): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('sync_version', ?);`,
    [String(version)]
  );
}

async function setLastSyncAt(timestamp: string): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('last_sync_at', ?);`,
    [timestamp]
  );
}

async function markExternalActivitySynced(payloadJson: string): Promise<void> {
  try {
    const payload = JSON.parse(payloadJson);
    const externalId = payload.external_id;
    if (externalId) {
      await executeSql(
        `UPDATE external_activities SET synced_flag = 1, updated_at = ? WHERE activity_hash = ?;`,
        [new Date().toISOString(), externalId]
      );
    }
  } catch {
    // Payload not parseable — skip flag update
  }
}
