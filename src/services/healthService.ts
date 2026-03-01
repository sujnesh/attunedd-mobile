import { executeSql } from '../db/database';

export interface ActivityRow {
  localId: number;
  source: string;
  startTime: number;
  durationMinutes: number;
  distanceM: number | null;
  avgHr: number | null;
  derivedZone: number;
  computedAsu: number;
  syncedFlag: boolean;
  createdAt: string;
  rawJson: string;
}

export async function getRecentActivities(limit: number = 50): Promise<ActivityRow[]> {
  const [result] = await executeSql(
    `SELECT * FROM external_activities ORDER BY start_time DESC LIMIT ?;`,
    [limit]
  );

  const activities: ActivityRow[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    activities.push({
      localId: row.local_id,
      source: row.source,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      distanceM: row.distance_m,
      avgHr: row.avg_hr,
      derivedZone: row.derived_zone,
      computedAsu: row.computed_asu,
      syncedFlag: row.synced_flag === 1,
      createdAt: row.created_at,
      rawJson: row.raw_json ?? '{}',
    });
  }

  return activities;
}

export async function getActivityCount(): Promise<number> {
  const [result] = await executeSql(
    `SELECT COUNT(*) as cnt FROM external_activities;`
  );
  return result.rows.item(0).cnt;
}
