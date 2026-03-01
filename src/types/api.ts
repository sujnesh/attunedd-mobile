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

export interface PenaltyItem {
  category: string;
  points: number;
  reason: string;
  metric_key: string;
}

export interface AuthoritativePolicySnapshot {
  projected_adaptation_score: number;
  risk_band: string;
  policy_caps: Record<string, unknown>;
  policy_reasons: string[];
  penalties?: PenaltyItem[];
  raw_metrics?: Record<string, unknown>;
}

export interface CoachingData {
  headline: string;
  tone: string;
  primary_factor: string | null;
  nudges: string[];
  positive_notes: string[];
}

export interface AuthoritativeState {
  workout_log: AuthoritativeWorkoutLog;
  exercise_sets: AuthoritativeExerciseSet[];
  policy_snapshot: AuthoritativePolicySnapshot;
  coaching?: CoachingData;
}

export interface DebriefData {
  score_before: number;
  score_after: number;
  adaptation_delta: number;
  band_before: string;
  band_after: string;
  band_dropped: boolean;
  stress_utilization: number;
  effort_rating: 'light' | 'moderate' | 'solid' | 'overdone';
  sets_logged: number;
  muscles_trained: string[];
  summary_line: string;
  override_count?: number;
  key_observation?: string;
}

export interface CoachingTodayResponse {
  adaptation_score: number;
  risk_band: string;
  coaching: CoachingData;
  policy_caps: Record<string, unknown>;
  penalties: PenaltyItem[];
  raw_metrics: Record<string, unknown>;
}

export interface ProjectionDay {
  date: string;
  session_type: string;
  coaching_mode: string;
  primary_muscles: string[];
  rest_reason: string | null;
}

export interface HeavySessionSimulation {
  current_strain_ratio: number;
  projected_strain_ratio: number;
  heavy_asu: number;
  warning: string | null;
}

export interface ProjectionsResponse {
  projections: ProjectionDay[];
  heavy_session_simulation: HeavySessionSimulation | null;
}

export interface PlanExercise {
  name: string;
  sets?: number;
  rep_range?: string;
  rpe_target?: number;
  rest_seconds?: number;
  duration_minutes?: number;
  zone?: string;
  intervals?: string;
  notes?: string | null;
  description?: string;
  coaching_tip?: string;
}

export interface PlanBlock {
  name: string;
  exercises: PlanExercise[];
}

export interface PlanDayData {
  date: string;
  session_id: number;
  session_type: string;
  rest_day: boolean;
  blocks: PlanBlock[];
  workout_status: string | null;
  today: boolean;
  rationale?: string;
}

export interface PlanData {
  id: number;
  name: string;
  training_type: string;
  starts_on: string;
  active: boolean;
}

export interface CurrentPlanResponse {
  plan: PlanData | null;
  week: PlanDayData[];
}

export interface WorkoutHistorySet {
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  stress_units: number | null;
  cap_override: boolean;
}

export interface WorkoutHistoryEntry {
  id: number;
  status: string;
  coaching_mode: string | null;
  actual_stress: number | null;
  allowed_stress: number | null;
  started_at: string | null;
  completed_at: string | null;
  risk_band: string | null;
  exercise_sets: WorkoutHistorySet[];
}

export interface WorkoutHistoryResponse {
  workouts: WorkoutHistoryEntry[];
  page: number;
  has_more: boolean;
}

export interface WhoopCycleData {
  date: string;
  recovery_score: number | null;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  strain: number | null;
}

export interface WhoopSleepData {
  date: string;
  performance_percentage: number | null;
  efficiency: number | null;
  total_sleep_hours: number | null;
}

export interface WhoopRecentResponse {
  cycles: WhoopCycleData[];
  sleep: WhoopSleepData[];
}

export interface SyncResponse {
  status: 'accepted' | 'rejected' | 'stale_client' | 'error';
  authoritative_state: AuthoritativeState;
  override_count: number;
  sync_version: number;
  message?: string;
  debrief?: DebriefData;
}

export interface SyncRequestHeaders {
  'Idempotency-Key': string;
  'X-Device-ID': string;
  'X-Sync-Version': string;
  'Content-Type': 'application/json';
  Authorization: string;
}
