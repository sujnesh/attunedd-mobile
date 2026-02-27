export interface AuthoritativeWorkoutLog {
  id: number;
  server_id: string;
  status: string;
  actual_stress: number;
  allowed_stress: number;
  planned_stress: number;
  capacity_score: number;
  coaching_mode: string | null;
  override_flag: boolean;
  started_at: string;
  completed_at: string | null;
  mobile_local_id: string | null;
}

export interface AuthoritativeExerciseSet {
  id: number;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  stress_units: number | null;
  muscle_group: string | null;
  movement_pattern: string | null;
  cap_override: boolean;
}

export interface AuthoritativePolicySnapshot {
  projected_adaptation_score: number;
  risk_band: string;
  policy_caps: Record<string, unknown>;
  policy_reasons: string[];
}

export interface AuthoritativeState {
  workout_log: AuthoritativeWorkoutLog;
  exercise_sets: AuthoritativeExerciseSet[];
  policy_snapshot: AuthoritativePolicySnapshot;
}

export interface SyncResponse {
  status: 'accepted' | 'rejected' | 'stale_client' | 'error';
  authoritative_state: AuthoritativeState;
  override_count: number;
  sync_version: number;
  message?: string;
}

export interface SyncRequestHeaders {
  'Idempotency-Key': string;
  'X-Device-ID': string;
  'X-Sync-Version': string;
  'Content-Type': 'application/json';
  Authorization: string;
}
