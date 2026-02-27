export const SCHEMA_VERSION = 3;

export const CREATE_WORKOUT_LOGS = `
  CREATE TABLE IF NOT EXISTS workout_logs (
    local_id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    actual_stress REAL DEFAULT 0.0,
    allowed_stress REAL DEFAULT 0.0,
    planned_stress REAL DEFAULT 0.0,
    capacity_score REAL DEFAULT 1.0,
    coaching_mode TEXT,
    override_flag INTEGER DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    mobile_local_id TEXT,
    planned_session_id INTEGER,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export const CREATE_EXERCISE_SETS = `
  CREATE TABLE IF NOT EXISTS exercise_sets (
    local_id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT,
    workout_log_local_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    weight REAL,
    reps INTEGER,
    rpe REAL,
    stress_units REAL,
    muscle_group TEXT,
    movement_pattern TEXT,
    cap_override INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workout_log_local_id) REFERENCES workout_logs(local_id)
  );
`;

export const CREATE_EXTERNAL_ACTIVITIES = `
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
`;

export const CREATE_POLICY_SNAPSHOTS = `
  CREATE TABLE IF NOT EXISTS policy_snapshots (
    local_id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT,
    workout_log_local_id INTEGER NOT NULL,
    projected_adaptation_score INTEGER,
    risk_band TEXT,
    policy_caps TEXT,
    policy_reasons TEXT,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workout_log_local_id) REFERENCES workout_logs(local_id)
  );
`;

export const CREATE_SYNC_QUEUE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    local_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    device_id TEXT NOT NULL,
    app_version TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    external_activity_hash TEXT,
    created_at TEXT NOT NULL
  );
`;

export const CREATE_META_STATE = `
  CREATE TABLE IF NOT EXISTS meta_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_workout_logs_server_id ON workout_logs(server_id);',
  'CREATE INDEX IF NOT EXISTS idx_workout_logs_mobile_local_id ON workout_logs(mobile_local_id);',
  'CREATE INDEX IF NOT EXISTS idx_exercise_sets_workout ON exercise_sets(workout_log_local_id);',
  'CREATE INDEX IF NOT EXISTS idx_exercise_sets_server_id ON exercise_sets(server_id);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_activity_hash ON sync_queue(external_activity_hash);',
  'CREATE INDEX IF NOT EXISTS idx_external_activities_hash ON external_activities(activity_hash);',
  'CREATE INDEX IF NOT EXISTS idx_external_activities_synced ON external_activities(synced_flag);',
];

export const ALL_TABLES = [
  CREATE_WORKOUT_LOGS,
  CREATE_EXERCISE_SETS,
  CREATE_EXTERNAL_ACTIVITIES,
  CREATE_POLICY_SNAPSHOTS,
  CREATE_SYNC_QUEUE,
  CREATE_META_STATE,
];
