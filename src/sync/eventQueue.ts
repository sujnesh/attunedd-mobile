import { executeSql, nowISO } from '../db/database';
import type { SyncEvent, IngestExternalActivityPayload } from './eventTypes';
import { EVENT_TYPES } from './eventTypes';

export interface QueuedEvent {
  local_id: number;
  event_id: string;
  type: string;
  payload: string;
  device_id: string;
  app_version: string;
  retry_count: number;
  external_activity_hash: string | null;
  created_at: string;
}

export async function enqueueEvent(event: SyncEvent): Promise<void> {
  const externalActivityHash =
    event.type === EVENT_TYPES.INGEST_EXTERNAL_ACTIVITY
      ? (event.payload as IngestExternalActivityPayload).external_activity_hash
      : null;

  await executeSql(
    `INSERT INTO sync_queue (event_id, type, payload, device_id, app_version, retry_count, external_activity_hash, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
    [
      event.id,
      event.type,
      JSON.stringify(event.payload),
      event.device_id,
      event.app_version,
      externalActivityHash,
      nowISO(),
    ]
  );
}

export async function getPendingEvents(): Promise<QueuedEvent[]> {
  const [results] = await executeSql(
    `SELECT local_id, event_id, type, payload, device_id, app_version, retry_count, external_activity_hash, created_at
     FROM sync_queue
     ORDER BY created_at ASC;`
  );

  const events: QueuedEvent[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    events.push(results.rows.item(i));
  }
  return events;
}

export async function markEventSynced(eventId: string): Promise<void> {
  await executeSql(`DELETE FROM sync_queue WHERE event_id = ?;`, [eventId]);
}

export async function incrementRetry(eventId: string): Promise<void> {
  await executeSql(
    `UPDATE sync_queue SET retry_count = retry_count + 1 WHERE event_id = ?;`,
    [eventId]
  );
}

export async function clearFailedEvents(threshold: number = 5): Promise<number> {
  const [results] = await executeSql(
    `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count >= ?;`,
    [threshold]
  );
  const count = results.rows.item(0).count;

  await executeSql(`DELETE FROM sync_queue WHERE retry_count >= ?;`, [threshold]);

  return count;
}

export async function getQueueSize(): Promise<number> {
  const [results] = await executeSql(`SELECT COUNT(*) as count FROM sync_queue;`);
  return results.rows.item(0).count;
}
