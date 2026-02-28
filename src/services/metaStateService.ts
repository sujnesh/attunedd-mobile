import { executeSql } from '../db/database';
import { deriveCaps, type PolicyCaps } from '../state/evaluationEngine';
import type { CoachingData, PenaltyItem } from '../types/api';

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
  penalties: PenaltyItem[];
  rawMetrics: Record<string, unknown>;
  source: 'server' | 'local';
  coaching: CoachingData | null;
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
    'last_penalties_json',
    'last_raw_metrics_json',
    'last_evaluation_source',
    'last_coaching_json',
  ];

  const [result] = await executeSql(
    `SELECT key, value FROM meta_state WHERE key IN (?, ?, ?, ?, ?, ?, ?);`,
    keys
  );

  const emptyResult: EvaluationData = {
    score: null, band: null, caps: null, timestamp: null,
    penalties: [], rawMetrics: {}, source: 'local', coaching: null,
  };

  if (result.rows.length === 0) {
    return emptyResult;
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
    return emptyResult;
  }

  const score = Math.round(parseFloat(scoreRaw));
  const timestamp = tsRaw ? parseInt(tsRaw, 10) : null;
  const caps = toParsedCaps(deriveCaps(band));

  let penalties: PenaltyItem[] = [];
  try {
    penalties = map.last_penalties_json ? JSON.parse(map.last_penalties_json) : [];
  } catch {
    penalties = [];
  }

  let rawMetrics: Record<string, unknown> = {};
  try {
    rawMetrics = map.last_raw_metrics_json ? JSON.parse(map.last_raw_metrics_json) : {};
  } catch {
    rawMetrics = {};
  }

  const source: 'server' | 'local' = map.last_evaluation_source === 'server' ? 'server' : 'local';

  let coaching: CoachingData | null = null;
  try {
    coaching = map.last_coaching_json ? JSON.parse(map.last_coaching_json) : null;
  } catch {
    coaching = null;
  }

  return { score, band, caps, timestamp, penalties, rawMetrics, source, coaching };
}
