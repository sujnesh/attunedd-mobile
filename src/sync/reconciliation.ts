import { executeSql, nowISO } from '../db/database';
import type { AuthoritativeState } from '../types/api';

export async function applyAuthoritativeState(
  state: AuthoritativeState,
  mobileLocalId: string | null
): Promise<void> {
  const wl = state.workout_log;
  const now = nowISO();

  // Find local workout by server_id or mobile_local_id
  let workoutLocalId: number | null = null;

  if (wl.server_id) {
    const [existing] = await executeSql(
      `SELECT local_id FROM workout_logs WHERE server_id = ? LIMIT 1;`,
      [wl.server_id]
    );
    if (existing.rows.length > 0) {
      workoutLocalId = existing.rows.item(0).local_id;
    }
  }

  if (workoutLocalId === null && mobileLocalId) {
    const [existing] = await executeSql(
      `SELECT local_id FROM workout_logs WHERE mobile_local_id = ? LIMIT 1;`,
      [mobileLocalId]
    );
    if (existing.rows.length > 0) {
      workoutLocalId = existing.rows.item(0).local_id;
    }
  }

  await executeSql('BEGIN TRANSACTION;');
  try {
    if (workoutLocalId !== null) {
      // Replace existing workout_log
      await executeSql(
        `UPDATE workout_logs SET
           server_id = ?,
           status = ?,
           actual_stress = ?,
           allowed_stress = ?,
           planned_stress = ?,
           capacity_score = ?,
           coaching_mode = ?,
           override_flag = ?,
           started_at = ?,
           completed_at = ?,
           mobile_local_id = ?,
           updated_at = ?
         WHERE local_id = ?;`,
        [
          wl.server_id || null,
          wl.status,
          wl.actual_stress,
          wl.allowed_stress,
          wl.planned_stress,
          wl.capacity_score,
          wl.coaching_mode,
          wl.override_flag ? 1 : 0,
          wl.started_at,
          wl.completed_at,
          wl.mobile_local_id,
          now,
          workoutLocalId,
        ]
      );
    } else {
      // Insert new workout_log
      const [insertResult] = await executeSql(
        `INSERT INTO workout_logs
           (server_id, status, actual_stress, allowed_stress, planned_stress,
            capacity_score, coaching_mode, override_flag, started_at,
            completed_at, mobile_local_id, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          wl.server_id || null,
          wl.status,
          wl.actual_stress,
          wl.allowed_stress,
          wl.planned_stress,
          wl.capacity_score,
          wl.coaching_mode,
          wl.override_flag ? 1 : 0,
          wl.started_at,
          wl.completed_at,
          wl.mobile_local_id,
          now,
          now,
        ]
      );
      workoutLocalId = insertResult.insertId ?? null;
    }

    // Replace exercise_sets: delete all, re-insert from server
    await executeSql(
      `DELETE FROM exercise_sets WHERE workout_log_local_id = ?;`,
      [workoutLocalId]
    );

    for (const set of state.exercise_sets) {
      await executeSql(
        `INSERT INTO exercise_sets
           (server_id, workout_log_local_id, exercise_name, set_number,
            weight, reps, rpe, stress_units, muscle_group,
            movement_pattern, cap_override, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          set.id ? String(set.id) : null,
          workoutLocalId,
          set.exercise_name,
          set.set_number,
          set.weight,
          set.reps,
          set.rpe,
          set.stress_units,
          set.muscle_group,
          set.movement_pattern,
          set.cap_override ? 1 : 0,
          now,
          now,
        ]
      );
    }

    // Replace policy_snapshot: delete existing, insert fresh
    await executeSql(
      `DELETE FROM policy_snapshots WHERE workout_log_local_id = ?;`,
      [workoutLocalId]
    );

    const ps = state.policy_snapshot;
    await executeSql(
      `INSERT INTO policy_snapshots
         (workout_log_local_id, projected_adaptation_score, risk_band,
          policy_caps, policy_reasons, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        workoutLocalId,
        ps.projected_adaptation_score,
        ps.risk_band,
        JSON.stringify(ps.policy_caps),
        JSON.stringify(ps.policy_reasons),
        now,
        now,
      ]
    );

    // Persist penalty data and score to meta_state for dashboard
    if (ps.penalties && ps.penalties.length > 0) {
      await executeSql(
        `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
        ['last_penalties_json', JSON.stringify(ps.penalties)]
      );
      await executeSql(
        `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
        ['last_raw_metrics_json', JSON.stringify(ps.raw_metrics || {})]
      );
      await executeSql(
        `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
        ['last_evaluation_source', 'server']
      );
    }
    await executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
      ['last_adaptation_score', String(ps.projected_adaptation_score)]
    );
    await executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
      ['last_risk_band', ps.risk_band]
    );

    // Persist coaching data for dashboard headline/nudges
    if (state.coaching) {
      await executeSql(
        `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
        ['last_coaching_json', JSON.stringify(state.coaching)]
      );
    }

    await executeSql('COMMIT;');
  } catch (e) {
    await executeSql('ROLLBACK;');
    throw e;
  }
}
