import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { ALL_TABLES, CREATE_INDEXES, CREATE_SESSION_DRAFTS, SCHEMA_VERSION } from './schema';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const currentVersion = await getSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    // Fresh install — create all tables
    await db.executeSql('BEGIN TRANSACTION;');
    try {
      for (const ddl of ALL_TABLES) {
        await db.executeSql(ddl);
      }

      for (const idx of CREATE_INDEXES) {
        await db.executeSql(idx);
      }

      await db.executeSql(
        `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('schema_version', ?);`,
        [String(SCHEMA_VERSION)]
      );
      await db.executeSql('COMMIT;');
    } catch (e) {
      await db.executeSql('ROLLBACK;');
      throw e;
    }
    return;
  }

  // Incremental migrations
  if (currentVersion < 2) {
    await migrateV1toV2(db);
  }

  if (currentVersion < 3) {
    await migrateV2toV3(db);
  }

  if (currentVersion < 4) {
    await migrateV3toV4(db);
  }
}

async function migrateV1toV2(db: SQLiteDatabase): Promise<void> {
  await db.executeSql('BEGIN TRANSACTION;');
  try {
    await db.executeSql(`DROP TABLE IF EXISTS external_activities;`);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS external_activities (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT,
        source TEXT NOT NULL,
        activity_hash TEXT NOT NULL UNIQUE,
        start_time INTEGER NOT NULL,
        duration_minutes REAL NOT NULL,
        distance_m REAL,
        avg_hr REAL,
        derived_zone INTEGER NOT NULL DEFAULT 2,
        computed_asu REAL NOT NULL DEFAULT 0.0,
        raw_json TEXT NOT NULL,
        synced_flag INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_external_activities_hash ON external_activities(activity_hash);`
    );
    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_external_activities_synced ON external_activities(synced_flag);`
    );

    await db.executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('schema_version', ?);`,
      [String(2)]
    );
    await db.executeSql('COMMIT;');
  } catch (e) {
    await db.executeSql('ROLLBACK;');
    throw e;
  }
}

async function migrateV2toV3(db: SQLiteDatabase): Promise<void> {
  await db.executeSql('BEGIN TRANSACTION;');
  try {
    await db.executeSql(
      `ALTER TABLE sync_queue ADD COLUMN external_activity_hash TEXT;`
    );

    await db.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_activity_hash ON sync_queue(external_activity_hash);`
    );

    await db.executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('schema_version', ?);`,
      [String(3)]
    );
    await db.executeSql('COMMIT;');
  } catch (e) {
    await db.executeSql('ROLLBACK;');
    throw e;
  }
}

async function migrateV3toV4(db: SQLiteDatabase): Promise<void> {
  await db.executeSql('BEGIN TRANSACTION;');
  try {
    await db.executeSql(CREATE_SESSION_DRAFTS);

    await db.executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES ('schema_version', ?);`,
      [String(4)]
    );
    await db.executeSql('COMMIT;');
  } catch (e) {
    await db.executeSql('ROLLBACK;');
    throw e;
  }
}

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const [results] = await db.executeSql(
      `SELECT value FROM meta_state WHERE key = 'schema_version';`
    );
    if (results.rows.length > 0) {
      return parseInt(results.rows.item(0).value, 10) || 0;
    }
  } catch {
    // Table doesn't exist yet
  }
  return 0;
}
