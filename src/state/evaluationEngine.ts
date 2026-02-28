import { executeSql } from '../db/database';
import { computeDelta } from './deltaEngine';
import { sendNotification } from './notificationPolicy';

export interface PolicyCaps {
  max_rpe: number;
  max_allowed_stress_pct: number;
  block_heavy_neural: boolean;
  max_cardio_zone: number;
}

export interface EvaluationSnapshot {
  adaptation_score: number;
  risk_band: string;
  caps: PolicyCaps;
  caps_hash: string;
  timestamp: number;
}

let isEvaluating = false;

export async function runEvaluation(): Promise<void> {
  if (isEvaluating) return;
  isEvaluating = true;

  try {
    const current = await computeCurrentState();
    const previous = await loadLastSnapshot();
    const delta = computeDelta(current, previous);

    await persistSnapshot(current);

    if (delta.shouldNotify) {
      await sendNotification(delta.reason, current.adaptation_score, current.risk_band);
    }
  } finally {
    isEvaluating = false;
  }
}

async function computeCurrentState(): Promise<EvaluationSnapshot> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;

  const strengthBaseline = await getStrengthBaseline(twentyEightDaysAgo);

  const totalAsu7 = await computeTotalAsu(sevenDaysAgo, strengthBaseline);
  const totalAsu14 = await computeTotalAsu(fourteenDaysAgo, strengthBaseline);

  const avg7 = totalAsu7 / 7.0;
  const avg14 = totalAsu14 / 14.0;
  const rollingStrainRatio = avg14 > 0 ? avg7 / avg14 : 1.0;

  const capacity = await getLatestCapacity();

  const capacityComponent = Math.min(Math.max(capacity, 0), 1) * 50;
  const strainComponent = Math.min(Math.max(2.0 - rollingStrainRatio, 0), 1) * 50;
  const adaptationScore = Math.round(capacityComponent + strainComponent);

  let riskBand: string;
  if (adaptationScore >= 70) {
    riskBand = 'green';
  } else if (adaptationScore >= 40) {
    riskBand = 'yellow';
  } else {
    riskBand = 'red';
  }

  const caps = deriveCaps(riskBand);
  const capsHash = hashCaps(caps);

  return {
    adaptation_score: adaptationScore,
    risk_band: riskBand,
    caps,
    caps_hash: capsHash,
    timestamp: now,
  };
}

async function getStrengthBaseline(sinceMs: number): Promise<number> {
  const [result] = await executeSql(
    `SELECT AVG(actual_stress) as avg_stress FROM workout_logs
     WHERE status = 'completed' AND completed_at >= ? AND actual_stress > 0;`,
    [new Date(sinceMs).toISOString()]
  );
  if (result.rows.length > 0 && result.rows.item(0).avg_stress) {
    return result.rows.item(0).avg_stress;
  }
  return 0;
}

function strengthToAsu(raw: number, baseline: number): number {
  if (raw <= 0) return 0;
  if (baseline <= 0) return Math.min(75, 120);
  return Math.min(Math.max((raw / baseline) * 75, 0), 120);
}

async function computeTotalAsu(sinceMs: number, strengthBaseline: number): Promise<number> {
  const sinceIso = new Date(sinceMs).toISOString();

  const [strengthResult] = await executeSql(
    `SELECT actual_stress FROM workout_logs
     WHERE status = 'completed' AND completed_at >= ?;`,
    [sinceIso]
  );

  let total = 0;
  for (let i = 0; i < strengthResult.rows.length; i++) {
    const raw = strengthResult.rows.item(i).actual_stress || 0;
    total += strengthToAsu(raw, strengthBaseline);
  }

  const [cardioResult] = await executeSql(
    `SELECT computed_asu FROM external_activities WHERE start_time >= ?;`,
    [sinceMs]
  );

  for (let i = 0; i < cardioResult.rows.length; i++) {
    total += cardioResult.rows.item(i).computed_asu || 0;
  }

  return total;
}

async function getLatestCapacity(): Promise<number> {
  const [result] = await executeSql(
    `SELECT capacity_score FROM workout_logs
     WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1;`
  );
  if (result.rows.length > 0) {
    return result.rows.item(0).capacity_score ?? 1.0;
  }
  return 1.0;
}

export function deriveCaps(riskBand: string): PolicyCaps {
  switch (riskBand) {
    case 'red':
      return { max_rpe: 7, max_allowed_stress_pct: 70, block_heavy_neural: true, max_cardio_zone: 3 };
    case 'yellow':
      return { max_rpe: 8, max_allowed_stress_pct: 85, block_heavy_neural: false, max_cardio_zone: 4 };
    default:
      return { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 };
  }
}

function hashCaps(caps: PolicyCaps): string {
  const input = `${caps.max_rpe}|${caps.max_allowed_stress_pct}|${caps.block_heavy_neural}|${caps.max_cardio_zone}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

async function loadLastSnapshot(): Promise<EvaluationSnapshot | null> {
  const keys = [
    'last_evaluation_timestamp',
    'last_adaptation_score',
    'last_risk_band',
    'last_caps_hash',
  ];

  const [result] = await executeSql(
    `SELECT key, value FROM meta_state WHERE key IN (?, ?, ?, ?);`,
    keys
  );

  if (result.rows.length === 0) return null;

  const map: Record<string, string> = {};
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    map[row.key] = row.value;
  }

  if (!map.last_evaluation_timestamp || !map.last_adaptation_score || !map.last_risk_band) {
    return null;
  }

  const riskBand = map.last_risk_band;

  return {
    adaptation_score: parseFloat(map.last_adaptation_score),
    risk_band: riskBand,
    caps: deriveCaps(riskBand),
    caps_hash: map.last_caps_hash || '',
    timestamp: parseInt(map.last_evaluation_timestamp, 10),
  };
}

async function persistSnapshot(snapshot: EvaluationSnapshot): Promise<void> {
  const pairs: [string, string][] = [
    ['last_evaluation_timestamp', String(snapshot.timestamp)],
    ['last_adaptation_score', String(snapshot.adaptation_score)],
    ['last_risk_band', snapshot.risk_band],
    ['last_caps_hash', snapshot.caps_hash],
  ];

  for (const [key, value] of pairs) {
    await executeSql(
      `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
      [key, value]
    );
  }
}
