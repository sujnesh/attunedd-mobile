export const EVENT_TYPES = {
  START_WORKOUT: 'START_WORKOUT',
  LOG_SET: 'LOG_SET',
  COMPLETE_WORKOUT: 'COMPLETE_WORKOUT',
  OVERRIDE_SESSION: 'OVERRIDE_SESSION',
  INGEST_EXTERNAL_ACTIVITY: 'INGEST_EXTERNAL_ACTIVITY',
  SYNC_HEALTH_VITALS: 'SYNC_HEALTH_VITALS',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface StartWorkoutPayload {
  planned_session_id?: number;
  free_form: boolean;
  muscle_filter?: string;
}

export interface LogSetPayload {
  mobile_local_id: string;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  block_name?: string;
  exercise_index?: number;
  confirm_override: boolean;
}

export interface CompleteWorkoutPayload {
  mobile_local_id: string;
  override_reason?: string;
}

export interface OverrideSessionPayload {
  mobile_local_id: string;
}

export interface IngestExternalActivityPayload {
  source: string;
  activity_type: string;
  started_at: string;
  ended_at: string;
  strain: number | null;
  average_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  external_id: string;
  external_activity_hash: string;
  derived_zone?: number;
  computed_asu?: number;
  duration_minutes?: number;
}

export interface SyncHealthVitalsPayload {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  active_calories: number | null;
  steps: number | null;
  sleep_hours: number | null;
  weight_kg: number | null;
  sleep_samples: Array<{
    start: string;
    end: string;
    value: string;
  }>;
  step_samples: Array<{
    date: string;
    value: number;
  }>;
}

export type EventPayload =
  | StartWorkoutPayload
  | LogSetPayload
  | CompleteWorkoutPayload
  | OverrideSessionPayload
  | IngestExternalActivityPayload
  | SyncHealthVitalsPayload;

export interface SyncEvent {
  id: string;
  type: EventType;
  created_at: number;
  payload: EventPayload;
  device_id: string;
  app_version: string;
}
