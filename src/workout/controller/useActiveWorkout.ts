import { useCallback, useRef, useState } from 'react';
import { executeSql, generateUUID, nowISO } from '../../db/database';
import { deriveCaps } from '../../state/evaluationEngine';
import { runEvaluation } from '../../state/evaluationEngine';
import { enqueueEvent } from '../../sync/eventQueue';
import { EVENT_TYPES } from '../../sync/eventTypes';
import { getMeta, getLatestDebrief, clearDebrief } from '../../services/metaStateService';
import { flushQueue } from '../../sync/syncEngine';
import type { DebriefData } from '../../types/api';
import { detectPlannedFatigue, detectFreeFormFatigue } from '../../engine/fatigue';
import {
  initializeSession,
  addSet,
  removeLastSet,
  getRecentSetsForExercise,
  serialize,
  deserialize,
  type SessionState,
} from '../core/sessionState';
import { checkDeviation, type Deviation } from '../core/deviationEngine';
import { evaluateNudge } from '../core/nudgeEngine';
import {
  createOverrideTracker,
  incrementOverride,
  type OverrideState,
} from '../core/overrideTracker';
import type { PolicyCaps } from '../../engine/types';
import type {
  StartWorkoutPayload,
  LogSetPayload,
  CompleteWorkoutPayload,
} from '../../sync/eventTypes';

export interface DraftInfo {
  draftId: number;
  mode: 'planned' | 'free_form';
  setCount: number;
  createdAt: string;
}

export interface UseActiveWorkoutReturn {
  session: SessionState | null;
  overrides: OverrideState;
  nudge: string | null;
  fatigueExercises: Set<string>;
  loading: boolean;
  finishing: boolean;
  initSession: (mode: 'planned' | 'free_form', draftId?: number) => Promise<void>;
  submitSet: (
    exerciseName: string,
    weight: number | null,
    reps: number,
    rpe: number,
  ) => Promise<Deviation | null>;
  confirmOverride: (
    exerciseName: string,
    weight: number | null,
    reps: number,
    rpe: number,
    deviation: Deviation,
  ) => Promise<void>;
  undoLastSet: () => Promise<void>;
  finishSession: () => Promise<DebriefData | null>;
}

export async function getActiveDraft(): Promise<DraftInfo | null> {
  const [result] = await executeSql(
    `SELECT local_id, mode, state_json, created_at FROM session_drafts ORDER BY created_at DESC LIMIT 1;`
  );
  if (result.rows.length === 0) return null;

  const row = result.rows.item(0);
  const state: SessionState = JSON.parse(row.state_json);
  return {
    draftId: row.local_id,
    mode: row.mode,
    setCount: state.sets.length,
    createdAt: row.created_at,
  };
}

export async function discardDraft(draftId: number): Promise<void> {
  await executeSql(`DELETE FROM session_drafts WHERE local_id = ?;`, [draftId]);
}

export function useActiveWorkout(): UseActiveWorkoutReturn {
  const [session, setSession] = useState<SessionState | null>(null);
  const [overrides, setOverrides] = useState<OverrideState>(createOverrideTracker());
  const [nudge, setNudge] = useState<string | null>(null);
  const [fatigueExercises, setFatigueExercises] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const draftIdRef = useRef<number | null>(null);
  const mobileLocalIdRef = useRef<string>('');

  const persistDraft = useCallback(async (state: SessionState, overrideState: OverrideState) => {
    if (draftIdRef.current == null) return;
    const now = nowISO();
    await executeSql(
      `UPDATE session_drafts SET state_json = ?, override_json = ?, updated_at = ? WHERE local_id = ?;`,
      [serialize(state), JSON.stringify(overrideState), now, draftIdRef.current]
    );
  }, []);

  const initSession = useCallback(async (mode: 'planned' | 'free_form', existingDraftId?: number) => {
    setLoading(true);
    try {
      if (existingDraftId != null) {
        const [draftResult] = await executeSql(
          `SELECT * FROM session_drafts WHERE local_id = ?;`,
          [existingDraftId]
        );
        if (draftResult.rows.length > 0) {
          const draft = draftResult.rows.item(0);
          const restored = deserialize(draft.state_json);
          const restoredOverrides: OverrideState = draft.override_json
            ? JSON.parse(draft.override_json)
            : createOverrideTracker();

          draftIdRef.current = existingDraftId;
          mobileLocalIdRef.current = draft.mobile_local_id;

          // Rebuild fatigue set from restored state
          const restoredFatigue = new Set<string>();
          const exerciseNames = [...new Set(restored.sets.map(s => s.exerciseName))];
          for (const name of exerciseNames) {
            const recent = restored.sets
              .filter(s => s.exerciseName === name)
              .slice(-2)
              .reverse();
            const setData = recent.map(s => ({ rpe: s.rpe, reps: s.reps }));
            if (setData.length >= 2) {
              const fatigue = restored.mode === 'free_form'
                ? detectFreeFormFatigue(setData)
                : detectPlannedFatigue(setData, 7, '8-12');
              if (fatigue) restoredFatigue.add(name);
            }
          }

          setSession(restored);
          setOverrides(restoredOverrides);
          setNudge(evaluateNudge(restored));
          setFatigueExercises(restoredFatigue);
          setLoading(false);
          return;
        }
      }

      // Freeze caps at session start
      const band = await getMeta('last_risk_band');
      const caps = deriveCaps(band ?? 'green');
      const allowedStress = await computeAllowedStress(caps);
      const mobileLocalId = generateUUID();
      const state = initializeSession(mode, caps, allowedStress);

      // Create draft row
      const now = nowISO();
      const [insertResult] = await executeSql(
        `INSERT INTO session_drafts (mode, mobile_local_id, caps_json, state_json, override_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [mode, mobileLocalId, JSON.stringify(caps), serialize(state), JSON.stringify(createOverrideTracker()), now, now]
      );

      draftIdRef.current = insertResult.insertId!;
      mobileLocalIdRef.current = mobileLocalId;

      setSession(state);
      setOverrides(createOverrideTracker());
      setNudge(null);
      setFatigueExercises(new Set());
    } finally {
      setLoading(false);
    }
  }, [persistDraft]);

  const applySet = useCallback(async (
    currentSession: SessionState,
    currentOverrides: OverrideState,
    exerciseName: string,
    weight: number | null,
    reps: number,
    rpe: number,
    capOverride: boolean,
  ) => {
    const updated = addSet(currentSession, exerciseName, weight, reps, rpe, capOverride);

    // Check fatigue
    const recentSets = getRecentSetsForExercise(updated, exerciseName, 2);
    const setData = recentSets.map(s => ({ rpe: s.rpe, reps: s.reps }));
    let fatigue = false;
    if (setData.length >= 2) {
      fatigue = updated.mode === 'free_form'
        ? detectFreeFormFatigue(setData)
        : detectPlannedFatigue(setData, 7, '8-12');
    }

    if (fatigue) {
      setFatigueExercises(prev => new Set(prev).add(exerciseName));
    }

    const newNudge = evaluateNudge(updated);
    setSession(updated);
    setNudge(newNudge);
    await persistDraft(updated, currentOverrides);
  }, [persistDraft]);

  const submitSet = useCallback(async (
    exerciseName: string,
    weight: number | null,
    reps: number,
    rpe: number,
  ): Promise<Deviation | null> => {
    if (!session) return null;

    const deviation = checkDeviation(
      exerciseName, rpe, session.cumulativeStress, session.allowedStress, session.caps
    );
    if (deviation) {
      return deviation;
    }

    await applySet(session, overrides, exerciseName, weight, reps, rpe, false);
    return null;
  }, [session, overrides, applySet]);

  const confirmOverride = useCallback(async (
    exerciseName: string,
    weight: number | null,
    reps: number,
    rpe: number,
    deviation: Deviation,
  ) => {
    if (!session) return;

    const newOverrides = incrementOverride(overrides, exerciseName, deviation.type);
    setOverrides(newOverrides);
    await applySet(session, newOverrides, exerciseName, weight, reps, rpe, true);
  }, [session, overrides, applySet]);

  const undoLastSet = useCallback(async () => {
    if (!session || session.sets.length === 0) return;
    const updated = removeLastSet(session);
    setSession(updated);
    setNudge(evaluateNudge(updated));
    await persistDraft(updated, overrides);
  }, [session, overrides, persistDraft]);

  const finishSession = useCallback(async (): Promise<DebriefData | null> => {
    if (!session || finishing) return null;
    setFinishing(true);
    try {
      const now = nowISO();
      const mobileLocalId = mobileLocalIdRef.current;
      const deviceId = await getDeviceId();
      const appVersion = await getAppVersion();

      // Clear any stale debrief before starting
      await clearDebrief();

      // Atomic finish: transaction wraps workout_log + exercise_sets + draft deletion
      await executeSql('BEGIN TRANSACTION;');
      try {
        const [wlResult] = await executeSql(
          `INSERT INTO workout_logs
             (status, actual_stress, allowed_stress, planned_stress,
              capacity_score, coaching_mode, override_flag, started_at,
              completed_at, mobile_local_id, updated_at, created_at)
           VALUES (?, ?, ?, 0, 1.0, ?, ?, ?, ?, ?, ?, ?);`,
          [
            'completed',
            session.cumulativeStress,
            session.allowedStress,
            session.mode,
            overrides.count > 0 ? 1 : 0,
            new Date(session.startedAt).toISOString(),
            now,
            mobileLocalId,
            now,
            now,
          ]
        );
        const workoutId = wlResult.insertId!;

        for (const s of session.sets) {
          await executeSql(
            `INSERT INTO exercise_sets
               (workout_log_local_id, exercise_name, set_number,
                weight, reps, rpe, stress_units, cap_override,
                updated_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [workoutId, s.exerciseName, s.setNumber, s.weight, s.reps, s.rpe,
             s.stressUnits, s.capOverride ? 1 : 0, now, now]
          );
        }

        if (draftIdRef.current != null) {
          await executeSql(
            `DELETE FROM session_drafts WHERE local_id = ?;`,
            [draftIdRef.current]
          );
        }

        await executeSql('COMMIT;');
      } catch (e) {
        await executeSql('ROLLBACK;');
        throw e;
      }

      // Enqueue sync events outside transaction (non-fatal)
      const startPayload: StartWorkoutPayload = {
        free_form: session.mode === 'free_form',
      };
      await enqueueEvent({
        id: generateUUID(),
        type: EVENT_TYPES.START_WORKOUT,
        created_at: session.startedAt,
        payload: startPayload,
        device_id: deviceId,
        app_version: appVersion,
      });

      for (const s of session.sets) {
        const logPayload: LogSetPayload = {
          workout_log_id: mobileLocalId,
          exercise_name: s.exerciseName,
          set_number: s.setNumber,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          confirm_override: s.capOverride,
        };
        await enqueueEvent({
          id: generateUUID(),
          type: EVENT_TYPES.LOG_SET,
          created_at: s.timestamp,
          payload: logPayload,
          device_id: deviceId,
          app_version: appVersion,
        });
      }

      const completePayload: CompleteWorkoutPayload = {
        workout_log_id: mobileLocalId,
      };
      await enqueueEvent({
        id: generateUUID(),
        type: EVENT_TYPES.COMPLETE_WORKOUT,
        created_at: Date.now(),
        payload: completePayload,
        device_id: deviceId,
        app_version: appVersion,
      });

      // Blocking sync flush — server authoritative debrief
      const authToken = await getMeta('auth_token');
      if (authToken) {
        const flushResult = await flushQueue(authToken);
        if (flushResult.accepted > 0) {
          const debrief = await getLatestDebrief();
          if (debrief) return debrief;
        }
        if (flushResult.failed > 0) {
          throw new Error('Sync failed. Please retry.');
        }
      }

      // Fallback: run local evaluation if no auth token (offline dev)
      await runEvaluation();
      return null;
    } finally {
      setFinishing(false);
    }
  }, [session, overrides, finishing]);

  return {
    session,
    overrides,
    nudge,
    fatigueExercises,
    loading,
    finishing,
    initSession,
    submitSet,
    confirmOverride,
    undoLastSet,
    finishSession,
  };
}

async function computeAllowedStress(caps: PolicyCaps): Promise<number> {
  const [result] = await executeSql(
    `SELECT AVG(actual_stress) as avg FROM (
       SELECT actual_stress FROM workout_logs
       WHERE status = 'completed' AND actual_stress > 0
       ORDER BY completed_at DESC LIMIT 10
     );`
  );
  const avg = result.rows.item(0)?.avg ?? 0;
  if (avg <= 0) return 0;
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
