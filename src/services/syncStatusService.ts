import { executeSql } from '../db/database';
import { getMeta } from './metaStateService';

export interface SyncStatus {
  pendingCount: number;
  failedCount: number;
  syncVersion: number;
  lastSyncAt: string | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const [pendingResult] = await executeSql(
    `SELECT COUNT(*) as cnt FROM sync_queue;`
  );
  const pendingCount = pendingResult.rows.item(0).cnt;

  const [failedResult] = await executeSql(
    `SELECT COUNT(*) as cnt FROM sync_queue WHERE retry_count >= 3;`
  );
  const failedCount = failedResult.rows.item(0).cnt;

  const syncVersionStr = await getMeta('sync_version');
  const syncVersion = syncVersionStr ? parseInt(syncVersionStr, 10) : 0;

  const lastSyncAt = await getMeta('last_sync_at');

  return { pendingCount, failedCount, syncVersion, lastSyncAt };
}
