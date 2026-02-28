import { executeSql } from '../db/database';
import { deriveCaps, type PolicyCaps } from '../state/evaluationEngine';

export interface ParsedCaps {
  maxRpe: number;
  maxStressPct: number;
  blockHeavyNeural: boolean;
  maxCardioZone: number;
}

export interface EvaluationData {
  score: number | null;
  band: string | null;
  caps: ParsedCaps | null;
  timestamp: number | null;
}

export async function getMeta(key: string): Promise<string | null> {
  const [result] = await executeSql(
    `SELECT value FROM meta_state WHERE key = ?;`,
    [key]
  );
  if (result.rows.length > 0) {
    return result.rows.item(0).value;
  }
  return null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO meta_state (key, value) VALUES (?, ?);`,
    [key, value]
  );
}

function toParsedCaps(caps: PolicyCaps): ParsedCaps {
  return {
    maxRpe: caps.max_rpe,
    maxStressPct: caps.max_allowed_stress_pct,
    blockHeavyNeural: caps.block_heavy_neural,
    maxCardioZone: caps.max_cardio_zone,
  };
}

export async function getEvaluationSnapshot(): Promise<EvaluationData> {
  const keys = [
    'last_adaptation_score',
    'last_risk_band',
    'last_evaluation_timestamp',
  ];

  const [result] = await executeSql(
    `SELECT key, value FROM meta_state WHERE key IN (?, ?, ?);`,
    keys
  );

  if (result.rows.length === 0) {
    return { score: null, band: null, caps: null, timestamp: null };
  }

  const map: Record<string, string> = {};
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    map[row.key] = row.value;
  }

  const scoreRaw = map.last_adaptation_score;
  const band = map.last_risk_band ?? null;
  const tsRaw = map.last_evaluation_timestamp;

  if (!scoreRaw || !band) {
    return { score: null, band: null, caps: null, timestamp: null };
  }

  const score = Math.round(parseFloat(scoreRaw));
  const timestamp = tsRaw ? parseInt(tsRaw, 10) : null;
  const caps = toParsedCaps(deriveCaps(band));

  return { score, band, caps, timestamp };
}
