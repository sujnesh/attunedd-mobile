import { executeSql, generateUUID, nowISO } from '../db/database';
import { calculateStress } from '../engine/stress';
import { enforceCaps } from '../engine/caps';
import { detectPlannedFatigue, detectFreeFormFatigue } from '../engine/fatigue';
import { deriveCaps, type PolicyCaps } from '../state/evaluationEngine';
import { runEvaluation } from '../state/evaluationEngine';
import { enqueueEvent } from '../sync/eventQueue';
import { EVENT_TYPES } from '../sync/eventTypes';
import { getMeta } from './metaStateService';
import type { SetData } from '../engine/types';
import type { EnforcementResult } from '../engine/types';
import type {
  StartWorkoutPayload,
  LogSetPayload,
  CompleteWorkoutPayload,
} from '../sync/eventTypes';

export interface ExerciseSet {
  localId: number;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number;
  rpe: number;
  stressUnits: number;
  capOverride: boolean;
}

export interface WorkoutState {
  workoutId: number;
  mobileLocalId: string;
  mode: 'planned' | 'free_form';
  actualStress: number;
  allowedStress: number;
  sets: ExerciseSet[];
  caps: PolicyCaps;
}

export interface LogSetResult {
  set: ExerciseSet;
  totalStress: number;
  fatigue: boolean;
}

const HEAVY_NEURAL = new Set([
  'deadlift', 'squat', 'bench press', 'overhead press',
  'barbell row', 'power clean', 'snatch', 'clean and jerk',
  'front squat', 'romanian deadlift', 'sumo deadlift',
]);

function isHeavyNeural(name: string): boolean {
  return HEAVY_NEURAL.has(name.toLowerCase());
}

export async function startWorkout(
  mode: 'planned' | 'free_form'
): Promise<{ workoutId: number; mobileLocalId: string }> {
  const mobileLocalId = generateUUID();
  const now = nowISO();
  const allowedStress = await computeAllowedStress();

  const [result] = await executeSql(
    `INSERT INTO workout_logs
       (status, actual_stress, allowed_stress, planned_stress,
        capacity_score, coaching_mode, override_flag, started_at,
        mobile_local_id, updated_at, created_at)
     VALUES (?, 0, ?, 0, 1.0, ?, 0, ?, ?, ?, ?);`,
    ['in_progress', allowedStress, mode, now, mobileLocalId, now, now]
  );

  const workoutId = result.insertId!;

  const deviceId = await getDeviceId();
  const appVersion = await getAppVersion();

  const payload: StartWorkoutPayload = {
    free_form: mode === 'free_form',
  };

  await enqueueEvent({
    id: generateUUID(),
    type: EVENT_TYPES.START_WORKOUT,
    created_at: Date.now(),
    payload,
    device_id: deviceId,
    app_version: appVersion,
  });

  return { workoutId, mobileLocalId };
}

export async function checkSetCaps(
  exerciseName: string,
  rpe: number,
  currentStress: number,
  allowedStress: number
): Promise<EnforcementResult> {
  const band = await getMeta('last_risk_band');
  const caps = deriveCaps(band ?? 'green');
  return enforceCaps(exerciseName, rpe, currentStress, allowedStress, caps, isHeavyNeural);
}

export async function logSet(
  workoutId: number,
  mobileLocalId: string,
  exerciseName: string,
  weight: number | null,
  reps: number,
  rpe: number,
  overrideCap: boolean
): Promise<LogSetResult> {
  const now = nowISO();
  const stressUnits = calculateStress(weight, reps, rpe);

  const [countResult] = await executeSql(
    `SELECT COUNT(*) as cnt FROM exercise_sets
     WHERE workout_log_local_id = ? AND exercise_name = ?;`,
    [workoutId, exerciseName]
  );
  const setNumber = countResult.rows.item(0).cnt + 1;

  await executeSql(
    `INSERT INTO exercise_sets
       (workout_log_local_id, exercise_name, set_number,
        weight, reps, rpe, stress_units, cap_override,
        updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [workoutId, exerciseName, setNumber, weight, reps, rpe,
     stressUnits, overrideCap ? 1 : 0, now, now]
  );

  const [insertResult] = await executeSql(
    `SELECT last_insert_rowid() as id;`
  );
  const localId = insertResult.rows.item(0).id;

  await executeSql(
    `UPDATE workout_logs
     SET actual_stress = actual_stress + ?, override_flag = CASE WHEN ? = 1 THEN 1 ELSE override_flag END, updated_at = ?
     WHERE local_id = ?;`,
    [stressUnits, overrideCap ? 1 : 0, now, workoutId]
  );

  const deviceId = await getDeviceId();
  const appVersion = await getAppVersion();

  const payload: LogSetPayload = {
    mobile_local_id: mobileLocalId,
    exercise_name: exerciseName,
    set_number: setNumber,
    weight,
    reps,
    rpe,
    confirm_override: overrideCap,
  };

  await enqueueEvent({
    id: generateUUID(),
    type: EVENT_TYPES.LOG_SET,
    created_at: Date.now(),
    payload,
    device_id: deviceId,
    app_version: appVersion,
  });

  const [stressResult] = await executeSql(
    `SELECT actual_stress FROM workout_logs WHERE local_id = ?;`,
    [workoutId]
  );
  const totalStress = stressResult.rows.item(0).actual_stress;

  const fatigue = await checkFatigue(workoutId, exerciseName);

  return {
    set: { localId, exerciseName, setNumber, weight, reps, rpe, stressUnits, capOverride: overrideCap },
    totalStress,
    fatigue,
  };
}

export async function getWorkoutState(workoutId: number): Promise<WorkoutState> {
  const [wlResult] = await executeSql(
    `SELECT * FROM workout_logs WHERE local_id = ?;`,
    [workoutId]
  );
  const wl = wlResult.rows.item(0);

  const [setsResult] = await executeSql(
    `SELECT * FROM exercise_sets WHERE workout_log_local_id = ? ORDER BY exercise_name, set_number;`,
    [workoutId]
  );

  const sets: ExerciseSet[] = [];
  for (let i = 0; i < setsResult.rows.length; i++) {
    const row = setsResult.rows.item(i);
    sets.push({
      localId: row.local_id,
      exerciseName: row.exercise_name,
      setNumber: row.set_number,
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe,
      stressUnits: row.stress_units,
      capOverride: row.cap_override === 1,
    });
  }

  const band = await getMeta('last_risk_band');
  const caps = deriveCaps(band ?? 'green');

  return {
    workoutId,
    mobileLocalId: wl.mobile_local_id,
    mode: wl.coaching_mode ?? 'free_form',
    actualStress: wl.actual_stress,
    allowedStress: wl.allowed_stress,
    sets,
    caps,
  };
}

export async function finishWorkout(workoutId: number): Promise<void> {
  const now = nowISO();

  const [wlResult] = await executeSql(
    `SELECT mobile_local_id FROM workout_logs WHERE local_id = ?;`,
    [workoutId]
  );
  const mobileLocalId = wlResult.rows.item(0).mobile_local_id;

  await executeSql(
    `UPDATE workout_logs SET status = 'completed', completed_at = ?, updated_at = ? WHERE local_id = ?;`,
    [now, now, workoutId]
  );

  const deviceId = await getDeviceId();
  const appVersion = await getAppVersion();

  const payload: CompleteWorkoutPayload = {
    mobile_local_id: mobileLocalId,
  };

  await enqueueEvent({
    id: generateUUID(),
    type: EVENT_TYPES.COMPLETE_WORKOUT,
    created_at: Date.now(),
    payload,
    device_id: deviceId,
    app_version: appVersion,
  });

  await runEvaluation();
}

async function checkFatigue(workoutId: number, exerciseName: string): Promise<boolean> {
  const [result] = await executeSql(
    `SELECT rpe, reps FROM exercise_sets
     WHERE workout_log_local_id = ? AND exercise_name = ?
     ORDER BY set_number DESC LIMIT 2;`,
    [workoutId, exerciseName]
  );

  if (result.rows.length < 2) return false;

  const recentSets: SetData[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    recentSets.push({
      rpe: result.rows.item(i).rpe,
      reps: result.rows.item(i).reps,
    });
  }

  const [wlResult] = await executeSql(
    `SELECT coaching_mode FROM workout_logs WHERE local_id = ?;`,
    [workoutId]
  );
  const mode = wlResult.rows.item(0).coaching_mode;

  if (mode === 'free_form') {
    return detectFreeFormFatigue(recentSets);
  }

  return detectPlannedFatigue(recentSets, 7, '8-12');
}

async function computeAllowedStress(): Promise<number> {
  const [result] = await executeSql(
    `SELECT AVG(actual_stress) as avg FROM (
       SELECT actual_stress FROM workout_logs
       WHERE status = 'completed' AND actual_stress > 0
       ORDER BY completed_at DESC LIMIT 10
     );`
  );
  const avg = result.rows.item(0)?.avg ?? 0;
  if (avg <= 0) return 0;

  const band = await getMeta('last_risk_band');
  const caps = deriveCaps(band ?? 'green');
  return avg * (caps.max_allowed_stress_pct / 100);
}

async function getDeviceId(): Promise<string> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'device_id';`
  );
  if (results.rows.length > 0) return results.rows.item(0).value;
  const id = generateUUID();
  await executeSql(
    `INSERT INTO meta_state (key, value) VALUES ('device_id', ?);`,
    [id]
  );
  return id;
}

async function getAppVersion(): Promise<string> {
  const [results] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'app_version';`
  );
  if (results.rows.length > 0) return results.rows.item(0).value;
  return '1.0.0';
}
