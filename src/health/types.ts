export type ActivitySource = 'apple' | 'health_connect' | 'whoop';

export interface RawActivity {
  source: ActivitySource;
  start_time: number;
  duration_minutes: number;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  activity_type: string;
  raw_json: string;
}

export interface NormalizedActivity {
  source: ActivitySource;
  start_time: number;
  duration_minutes: number;
  distance_m: number | null;
  avg_hr: number | null;
  derived_zone: number;
  computed_asu: number;
  raw_json: string;
}

export interface StoredActivity {
  local_id: number;
  server_id: string | null;
  source: string;
  activity_hash: string;
  start_time: number;
  duration_minutes: number;
  distance_m: number | null;
  avg_hr: number | null;
  derived_zone: number;
  computed_asu: number;
  raw_json: string;
  synced_flag: number;
  created_at: string;
  updated_at: string;
}
