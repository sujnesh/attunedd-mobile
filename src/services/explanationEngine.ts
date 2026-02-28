import type { PenaltyItem } from '../types/api';
import type { ParsedCaps } from './metaStateService';

export interface ExplanationInput {
  score: number;
  band: string;
  penalties: PenaltyItem[];
  rawMetrics: Record<string, unknown>;
  caps: ParsedCaps;
}

export interface PenaltyRow {
  category: string;
  points: number;
  description: string;
  icon: string;
}

export interface LimitRow {
  label: string;
  value: string;
  restricted: boolean;
}

export interface ExplanationOutput {
  decisionLine: string;
  penaltyBreakdown: PenaltyRow[];
  sessionLimits: LimitRow[];
  totalDeducted: number;
  hasServerData: boolean;
}

const DECISION_LINES: Record<string, string> = {
  green: "You're cleared for a full session.",
  yellow: 'Train with reduced intensity today.',
  red: 'Rest recommended — recovery is the priority.',
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  recovery_window: { label: 'Recovery', icon: '↻' },
  systemic_fatigue: { label: 'Fatigue', icon: '▼' },
  load_management: { label: 'Load', icon: '◆' },
  stimulus_balance: { label: 'Balance', icon: '⚖' },
  override_behavior: { label: 'Overrides', icon: '⚠' },
};

const DEFAULT_CATEGORY_META = { label: 'Other', icon: '•' };

type DescriptionFormatter = (penalty: PenaltyItem, rawMetrics: Record<string, unknown>) => string;

function pctValue(rawMetrics: Record<string, unknown>, key: string): string {
  const v = rawMetrics[key];
  if (typeof v === 'number') return `${Math.round(v * 100)}%`;
  return '?';
}

function ratioValue(rawMetrics: Record<string, unknown>): string {
  const v = rawMetrics.rolling_strain_ratio;
  if (typeof v === 'number') return `${v.toFixed(2)}x`;
  return '?';
}

const DESCRIPTION_FORMATTERS: Record<string, DescriptionFormatter> = {
  recently_trained_muscle: () => 'Same muscle group trained within 48 hours',
  heavy_neural_48h: () => 'Heavy compound lift done within 48 hours',
  low_capacity: (_p, rm) => `Recovery capacity very low (${pctValue(rm, 'capacity_score')})`,
  reduced_capacity: (_p, rm) => `Recovery capacity reduced (${pctValue(rm, 'capacity_score')})`,
  session_fatigue: () => 'Fatigue detected during current session',
  stress_ratio_high: (_p, rm) => `Training load significantly elevated (${ratioValue(rm)} baseline)`,
  stress_ratio_elevated: (_p, rm) => `Training load moderately elevated (${ratioValue(rm)} baseline)`,
  overtrained_muscle: () => 'Muscle group already exceeds weekly target',
  deficit_avoidance: () => "Session doesn't address undertrained muscle groups",
  overrides_14d: (_p, rm) => {
    const v = rm.overrides_14d;
    return `${typeof v === 'number' ? v : '?'} rest overrides in the past 14 days`;
  },
  overrides_7d: (_p, rm) => {
    const v = rm.overrides_7d;
    return `${typeof v === 'number' ? v : '?'} rest overrides in the past 7 days`;
  },
};

function formatDescription(penalty: PenaltyItem, rawMetrics: Record<string, unknown>): string {
  const formatter = DESCRIPTION_FORMATTERS[penalty.metric_key];
  if (formatter) return formatter(penalty, rawMetrics);
  return penalty.reason;
}

function buildPenaltyRow(penalty: PenaltyItem, rawMetrics: Record<string, unknown>): PenaltyRow {
  const meta = CATEGORY_META[penalty.category] ?? DEFAULT_CATEGORY_META;
  return {
    category: meta.label,
    points: penalty.points,
    description: formatDescription(penalty, rawMetrics),
    icon: meta.icon,
  };
}

function buildSessionLimits(caps: ParsedCaps): LimitRow[] {
  return [
    { label: 'MAX RPE', value: String(caps.maxRpe), restricted: caps.maxRpe < 10 },
    { label: 'STRESS', value: `${caps.maxStressPct}%`, restricted: caps.maxStressPct < 100 },
    { label: 'HEAVY NEURAL', value: caps.blockHeavyNeural ? 'BLOCKED' : 'OK', restricted: caps.blockHeavyNeural },
    { label: 'MAX ZONE', value: `Z${caps.maxCardioZone}`, restricted: caps.maxCardioZone < 5 },
  ];
}

export function buildExplanation(input: ExplanationInput): ExplanationOutput {
  const { score: _score, band, penalties, rawMetrics, caps } = input;

  const decisionLine = DECISION_LINES[band] ?? DECISION_LINES.yellow;

  const penaltyBreakdown = penalties
    .map((p) => buildPenaltyRow(p, rawMetrics))
    .sort((a, b) => b.points - a.points);

  const totalDeducted = penalties.reduce((sum, p) => sum + p.points, 0);
  const hasServerData = penalties.length > 0;
  const sessionLimits = buildSessionLimits(caps);

  return { decisionLine, penaltyBreakdown, sessionLimits, totalDeducted, hasServerData };
}
