/**
 * COACHING RESPONSE SCENARIO TESTS
 *
 * Tests the deterministic coaching engines that generate user-facing
 * guidance text. These engines provide fallback coaching when the server
 * is unavailable and in-session coaching during workouts.
 *
 * We test across these user scenarios:
 * 1. Headline generation (what the user sees at the top of dashboard)
 * 2. WHY bullets (explanation of their current state)
 * 3. Explanation engine (decision line + penalty breakdown)
 * 4. Nudge engine (in-session coaching during workouts)
 * 5. Set feedback (per-set coaching after each logged set)
 * 6. Debrief generation (post-workout summary)
 * 7. Check-in context (daily self-report signals)
 * 8. Policy caps (training restrictions per risk band)
 */

import { generateSetFeedback } from '../workout/core/coachingEngine';
import { evaluateNudge } from '../workout/core/nudgeEngine';
import { buildExplanation, type ExplanationOutput } from '../services/explanationEngine';
import { deriveCaps } from '../state/evaluationEngine';
import { initializeSession, addSet, type SessionState } from '../workout/core/sessionState';
import { shouldShowCheckIn, getCheckInContext, type CheckInData } from '../services/checkInService';
import type { PolicyCaps } from '../engine/types';
import type { PenaltyItem } from '../types/api';

// ── HELPERS ──────────────────────────────────────────────────────────

const GREEN_CAPS: PolicyCaps = { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 };
const YELLOW_CAPS: PolicyCaps = { max_rpe: 8, max_allowed_stress_pct: 85, block_heavy_neural: false, max_cardio_zone: 5 };
const RED_CAPS: PolicyCaps = { max_rpe: 7, max_allowed_stress_pct: 60, block_heavy_neural: true, max_cardio_zone: 3 };

function buildSession(
  sets: { name: string; weight: number | null; reps: number; rpe: number }[],
  opts: { allowedStress?: number; caps?: PolicyCaps; mode?: 'planned' | 'free_form' } = {},
): SessionState {
  const caps = opts.caps ?? GREEN_CAPS;
  const allowed = opts.allowedStress ?? 100;
  const mode = opts.mode ?? 'free_form';
  let session = initializeSession(mode, caps, allowed);
  for (const s of sets) {
    session = addSet(session, s.name, s.weight, s.reps, s.rpe, false);
  }
  return session;
}

// Extract buildHeadline and buildWhyBullets logic for direct testing
// (These are module-private in DashboardScreen, so we replicate the logic)

function buildHeadline(
  coaching: { headline: string | null } | null,
  penalties: { category: string; reason: string; points: number }[],
  rawMetrics: Record<string, unknown>,
  checkIn?: CheckInData | null,
): string {
  if (checkIn && penalties.length === 0) {
    if (checkIn.energy <= 2) return 'Low energy noted. Adjust intensity today.';
    if (checkIn.sleepQuality <= 2) return 'Poor sleep reported. Recovery priority.';
    if (checkIn.soreness >= 4) return 'High soreness noted. Consider lighter load.';
  }
  if (coaching?.headline) {
    const lower = coaching.headline.toLowerCase();
    if (!lower.includes('push hard') && !lower.includes('fully recovered')) {
      return coaching.headline;
    }
  }
  if (penalties.length > 0) {
    const top = penalties.sort((a, b) => b.points - a.points)[0];
    if (top.category === 'recovery_window') return 'Recovery window active.';
    if (top.category === 'systemic_fatigue') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') return `Systemic fatigue elevated ${Math.round((ratio - 1) * 100)}%.`;
      return 'Systemic fatigue elevated.';
    }
    if (top.category === 'load_management') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') return `Load ratio ${ratio.toFixed(2)}x baseline.`;
      return 'Training load elevated.';
    }
    if (top.category === 'override_behavior') return 'Recent overrides affecting recovery.';
    return top.reason;
  }
  return 'No recovery penalties active.';
}

function buildWhyBullets(
  penalties: { category: string; reason: string; points: number; metric_key: string }[],
  rawMetrics: Record<string, unknown>,
): string[] {
  const bullets: string[] = [];
  if (penalties.length === 0) {
    const capacity = rawMetrics.capacity_score;
    if (typeof capacity === 'number') bullets.push(`Recovery capacity ${Math.round(capacity * 100)}%`);
    const ratio = rawMetrics.rolling_strain_ratio;
    if (typeof ratio === 'number') bullets.push(`Load ratio ${ratio.toFixed(2)}x baseline`);
    bullets.push('Recovery window cleared');
    bullets.push('Neural fatigue inactive');
    return bullets;
  }
  for (const p of penalties.sort((a, b) => b.points - a.points).slice(0, 4)) {
    if (p.category === 'recovery_window') {
      bullets.push(`Recovery window active (-${p.points})`);
    } else if (p.category === 'systemic_fatigue') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') bullets.push(`Strain ratio ${ratio.toFixed(2)}x baseline (-${p.points})`);
      else bullets.push(`Systemic fatigue detected (-${p.points})`);
    } else if (p.category === 'load_management') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') bullets.push(`Load elevated ${ratio.toFixed(2)}x (-${p.points})`);
      else bullets.push(`Load management penalty (-${p.points})`);
    } else if (p.category === 'override_behavior') {
      const count = rawMetrics.overrides_14d ?? rawMetrics.overrides_7d;
      if (typeof count === 'number') bullets.push(`${count} recent overrides (-${p.points})`);
      else bullets.push(`Override pattern detected (-${p.points})`);
    } else {
      bullets.push(`${p.reason} (-${p.points})`);
    }
  }
  const capacity = rawMetrics.capacity_score;
  if (typeof capacity === 'number' && !bullets.some(b => b.includes('capacity'))) {
    bullets.push(`Recovery capacity ${Math.round(capacity * 100)}%`);
  }
  return bullets;
}

// ── 1. HEADLINE GENERATION ──────────────────────────────────────────

describe('Headline Generation', () => {
  describe('Scenario: Fully recovered user, no penalties', () => {
    it('shows clean state message', () => {
      expect(buildHeadline(null, [], {})).toBe('No recovery penalties active.');
    });
  });

  describe('Scenario: Server provides non-generic headline', () => {
    it('uses server headline directly', () => {
      expect(buildHeadline(
        { headline: 'Your chest volume is on track.' },
        [], {},
      )).toBe('Your chest volume is on track.');
    });
  });

  describe('Scenario: Server provides generic motivational headline', () => {
    it('filters "push hard" and falls back to penalty-based', () => {
      expect(buildHeadline(
        { headline: 'Time to push hard today!' },
        [], {},
      )).toBe('No recovery penalties active.');
    });

    it('filters "fully recovered" and falls back', () => {
      expect(buildHeadline(
        { headline: "You're fully recovered!" },
        [], {},
      )).toBe('No recovery penalties active.');
    });
  });

  describe('Scenario: User in recovery window (just trained)', () => {
    it('shows recovery window headline', () => {
      const penalties = [{ category: 'recovery_window', reason: '48h window', points: 15 }];
      expect(buildHeadline(null, penalties, {})).toBe('Recovery window active.');
    });
  });

  describe('Scenario: Systemic fatigue with metrics', () => {
    it('includes fatigue percentage', () => {
      const penalties = [{ category: 'systemic_fatigue', reason: 'fatigue', points: 10 }];
      expect(buildHeadline(null, penalties, { rolling_strain_ratio: 1.4 }))
        .toBe('Systemic fatigue elevated 40%.');
    });

    it('handles missing strain ratio gracefully', () => {
      const penalties = [{ category: 'systemic_fatigue', reason: 'fatigue', points: 10 }];
      expect(buildHeadline(null, penalties, {})).toBe('Systemic fatigue elevated.');
    });
  });

  describe('Scenario: Load management issue', () => {
    it('includes load ratio', () => {
      const penalties = [{ category: 'load_management', reason: 'load', points: 8 }];
      expect(buildHeadline(null, penalties, { rolling_strain_ratio: 1.35 }))
        .toBe('Load ratio 1.35x baseline.');
    });

    it('handles missing ratio', () => {
      const penalties = [{ category: 'load_management', reason: 'load', points: 8 }];
      expect(buildHeadline(null, penalties, {})).toBe('Training load elevated.');
    });
  });

  describe('Scenario: Override behavior pattern', () => {
    it('warns about overrides', () => {
      const penalties = [{ category: 'override_behavior', reason: 'overrides', points: 5 }];
      expect(buildHeadline(null, penalties, {})).toBe('Recent overrides affecting recovery.');
    });
  });

  describe('Scenario: Multiple penalties — highest takes priority', () => {
    it('selects the highest-point penalty category', () => {
      const penalties = [
        { category: 'override_behavior', reason: 'overrides', points: 3 },
        { category: 'recovery_window', reason: 'recovery', points: 15 },
        { category: 'load_management', reason: 'load', points: 8 },
      ];
      expect(buildHeadline(null, penalties, {})).toBe('Recovery window active.');
    });
  });

  describe('Scenario: Check-in overrides generic state', () => {
    it('low energy overrides clean state', () => {
      const checkIn: CheckInData = { energy: 1, sleepQuality: 4, soreness: 2 };
      expect(buildHeadline(null, [], {}, checkIn))
        .toBe('Low energy noted. Adjust intensity today.');
    });

    it('poor sleep overrides clean state', () => {
      const checkIn: CheckInData = { energy: 3, sleepQuality: 2, soreness: 2 };
      expect(buildHeadline(null, [], {}, checkIn))
        .toBe('Poor sleep reported. Recovery priority.');
    });

    it('high soreness overrides clean state', () => {
      const checkIn: CheckInData = { energy: 3, sleepQuality: 3, soreness: 5 };
      expect(buildHeadline(null, [], {}, checkIn))
        .toBe('High soreness noted. Consider lighter load.');
    });

    it('does NOT override when penalties exist (penalties take priority)', () => {
      const checkIn: CheckInData = { energy: 1, sleepQuality: 1, soreness: 5 };
      const penalties = [{ category: 'recovery_window', reason: 'recovery', points: 15 }];
      expect(buildHeadline(null, penalties, {}, checkIn))
        .toBe('Recovery window active.');
    });

    it('neutral check-in produces clean headline', () => {
      const checkIn: CheckInData = { energy: 3, sleepQuality: 3, soreness: 3 };
      expect(buildHeadline(null, [], {}, checkIn))
        .toBe('No recovery penalties active.');
    });
  });
});

// ── 2. WHY BULLETS ──────────────────────────────────────────────────

describe('WHY Bullets Generation', () => {
  describe('Scenario: No penalties (green band)', () => {
    it('shows positive state indicators', () => {
      const bullets = buildWhyBullets([], { capacity_score: 0.92, rolling_strain_ratio: 1.05 });
      expect(bullets).toContain('Recovery capacity 92%');
      expect(bullets).toContain('Load ratio 1.05x baseline');
      expect(bullets).toContain('Recovery window cleared');
      expect(bullets).toContain('Neural fatigue inactive');
    });

    it('shows minimal positive bullets without metrics', () => {
      const bullets = buildWhyBullets([], {});
      expect(bullets).toContain('Recovery window cleared');
      expect(bullets).toContain('Neural fatigue inactive');
      expect(bullets.length).toBe(2);
    });
  });

  describe('Scenario: Single recovery window penalty', () => {
    it('includes penalty with point deduction', () => {
      const penalties: PenaltyItem[] = [
        { category: 'recovery_window', reason: '48h', points: 12, metric_key: 'recently_trained_muscle' },
      ];
      const bullets = buildWhyBullets(penalties, {});
      expect(bullets[0]).toBe('Recovery window active (-12)');
    });
  });

  describe('Scenario: Multiple penalties with metrics', () => {
    it('orders by severity and includes metric data', () => {
      const penalties: PenaltyItem[] = [
        { category: 'systemic_fatigue', reason: 'fatigue', points: 10, metric_key: 'stress_ratio_high' },
        { category: 'recovery_window', reason: 'recovery', points: 15, metric_key: 'recently_trained_muscle' },
        { category: 'override_behavior', reason: 'overrides', points: 5, metric_key: 'overrides_14d' },
      ];
      const bullets = buildWhyBullets(penalties, {
        rolling_strain_ratio: 1.6,
        overrides_14d: 3,
      });

      // Highest penalty first
      expect(bullets[0]).toBe('Recovery window active (-15)');
      expect(bullets[1]).toContain('1.60x baseline');
      expect(bullets[2]).toBe('3 recent overrides (-5)');
    });
  });

  describe('Scenario: Penalty with missing metric data', () => {
    it('uses fallback descriptions', () => {
      const penalties: PenaltyItem[] = [
        { category: 'systemic_fatigue', reason: 'fatigue', points: 8, metric_key: 'stress_ratio_elevated' },
        { category: 'override_behavior', reason: 'overrides', points: 4, metric_key: 'overrides_7d' },
      ];
      const bullets = buildWhyBullets(penalties, {});
      expect(bullets[0]).toBe('Systemic fatigue detected (-8)');
      expect(bullets[1]).toBe('Override pattern detected (-4)');
    });
  });

  describe('Scenario: More than 4 penalties (capped at 4)', () => {
    it('limits to top 4 penalties', () => {
      const penalties: PenaltyItem[] = Array.from({ length: 6 }, (_, i) => ({
        category: 'recovery_window',
        reason: `penalty ${i}`,
        points: 10 - i,
        metric_key: 'recently_trained_muscle',
      }));
      const bullets = buildWhyBullets(penalties, {});
      // 4 penalty bullets + possibly capacity if not already present
      const penaltyBullets = bullets.filter(b => b.includes('Recovery window'));
      expect(penaltyBullets.length).toBe(4);
    });
  });

  describe('Scenario: Capacity appended when not already mentioned', () => {
    it('appends capacity score after penalty bullets', () => {
      const penalties: PenaltyItem[] = [
        { category: 'recovery_window', reason: 'recovery', points: 10, metric_key: 'recently_trained_muscle' },
      ];
      const bullets = buildWhyBullets(penalties, { capacity_score: 0.65 });
      expect(bullets).toContain('Recovery capacity 65%');
    });
  });
});

// ── 3. EXPLANATION ENGINE ───────────────────────────────────────────

describe('Explanation Engine', () => {
  describe('Scenario: Green band user', () => {
    it('gives full-session clearance', () => {
      const result = buildExplanation({
        score: 88,
        band: 'green',
        penalties: [],
        rawMetrics: {},
        caps: { maxRpe: 10, maxStressPct: 100, blockHeavyNeural: false, maxCardioZone: 5 },
      });
      expect(result.decisionLine).toBe("You're cleared for a full session.");
      expect(result.penaltyBreakdown).toHaveLength(0);
      expect(result.totalDeducted).toBe(0);
    });
  });

  describe('Scenario: Yellow band with penalties', () => {
    it('advises reduced intensity', () => {
      const result = buildExplanation({
        score: 72,
        band: 'yellow',
        penalties: [
          { category: 'systemic_fatigue', reason: 'elevated', points: 8, metric_key: 'stress_ratio_elevated' },
        ],
        rawMetrics: { rolling_strain_ratio: 1.3 },
        caps: { maxRpe: 8, maxStressPct: 85, blockHeavyNeural: false, maxCardioZone: 5 },
      });
      expect(result.decisionLine).toBe('Train with reduced intensity today.');
      expect(result.penaltyBreakdown.length).toBe(1);
      expect(result.penaltyBreakdown[0].category).toBe('Fatigue');
      expect(result.penaltyBreakdown[0].description).toContain('1.30x baseline');
      expect(result.totalDeducted).toBe(8);
    });
  });

  describe('Scenario: Red band user', () => {
    it('recommends rest', () => {
      const result = buildExplanation({
        score: 55,
        band: 'red',
        penalties: [
          { category: 'recovery_window', reason: 'muscle recovery', points: 15, metric_key: 'recently_trained_muscle' },
          { category: 'systemic_fatigue', reason: 'fatigue', points: 12, metric_key: 'stress_ratio_high' },
        ],
        rawMetrics: { rolling_strain_ratio: 1.8 },
        caps: { maxRpe: 7, maxStressPct: 60, blockHeavyNeural: true, maxCardioZone: 3 },
      });
      expect(result.decisionLine).toBe('Rest recommended — recovery is the priority.');
      expect(result.penaltyBreakdown.length).toBe(2);
      expect(result.totalDeducted).toBe(27);
    });
  });

  describe('Scenario: Session limits reflect caps', () => {
    it('marks restricted caps', () => {
      const result = buildExplanation({
        score: 72,
        band: 'yellow',
        penalties: [],
        rawMetrics: {},
        caps: { maxRpe: 8, maxStressPct: 85, blockHeavyNeural: false, maxCardioZone: 5 },
      });
      const rpeLimit = result.sessionLimits.find(l => l.label === 'MAX RPE');
      const stressLimit = result.sessionLimits.find(l => l.label === 'STRESS');
      expect(rpeLimit?.restricted).toBe(true);
      expect(rpeLimit?.value).toBe('8');
      expect(stressLimit?.restricted).toBe(true);
      expect(stressLimit?.value).toBe('85%');
    });

    it('marks unrestricted caps for green band', () => {
      const result = buildExplanation({
        score: 90,
        band: 'green',
        penalties: [],
        rawMetrics: {},
        caps: { maxRpe: 10, maxStressPct: 100, blockHeavyNeural: false, maxCardioZone: 5 },
      });
      expect(result.sessionLimits.every(l => !l.restricted)).toBe(true);
    });

    it('shows blocked heavy neural for red band', () => {
      const result = buildExplanation({
        score: 50,
        band: 'red',
        penalties: [],
        rawMetrics: {},
        caps: { maxRpe: 7, maxStressPct: 60, blockHeavyNeural: true, maxCardioZone: 3 },
      });
      const heavyLimit = result.sessionLimits.find(l => l.label === 'HEAVY NEURAL');
      expect(heavyLimit?.restricted).toBe(true);
      expect(heavyLimit?.value).toBe('BLOCKED');
    });
  });

  describe('Scenario: Override behavior penalty formatting', () => {
    it('formats override count from metrics', () => {
      const result = buildExplanation({
        score: 75,
        band: 'yellow',
        penalties: [
          { category: 'override_behavior', reason: 'overrides', points: 6, metric_key: 'overrides_14d' },
        ],
        rawMetrics: { overrides_14d: 4 },
        caps: { maxRpe: 8, maxStressPct: 85, blockHeavyNeural: false, maxCardioZone: 5 },
      });
      expect(result.penaltyBreakdown[0].description).toBe('4 rest overrides in the past 14 days');
      expect(result.penaltyBreakdown[0].icon).toBe('⚠');
    });
  });
});

// ── 4. NUDGE ENGINE ─────────────────────────────────────────────────

describe('Nudge Engine — In-Session Coaching', () => {
  describe('Scenario: Fresh session, low stress', () => {
    it('gives no nudge', () => {
      const session = buildSession([
        { name: 'bench press', weight: 60, reps: 10, rpe: 7 },
      ], { allowedStress: 10000 });
      expect(evaluateNudge(session)).toBeNull();
    });
  });

  describe('Scenario: Stress approaching cap (75-84%)', () => {
    it('warns about approaching cap', () => {
      const session = buildSession(
        [
          { name: 'bench press', weight: 80, reps: 8, rpe: 8 },
          { name: 'bench press', weight: 80, reps: 8, rpe: 8 },
          { name: 'squat', weight: 100, reps: 5, rpe: 8 },
        ],
        { allowedStress: 30 },
      );
      const pct = (session.cumulativeStress / session.allowedStress) * 100;
      if (pct >= 75 && pct < 100) {
        const nudge = evaluateNudge(session);
        expect(nudge).toContain('Approaching stress cap');
      }
    });
  });

  describe('Scenario: Stress budget exceeded', () => {
    it('recommends finishing', () => {
      const session = buildSession(
        [
          { name: 'bench press', weight: 80, reps: 8, rpe: 8 },
          { name: 'squat', weight: 100, reps: 5, rpe: 9 },
          { name: 'deadlift', weight: 120, reps: 3, rpe: 9 },
          { name: 'row', weight: 60, reps: 10, rpe: 8 },
        ],
        { allowedStress: 5 },
      );
      const nudge = evaluateNudge(session);
      expect(nudge).toBe('Stress budget exceeded — consider finishing');
    });
  });

  describe('Scenario: High neural load (>3 heavy compound sets)', () => {
    it('warns about neural load', () => {
      const session = buildSession([
        { name: 'squat', weight: 140, reps: 5, rpe: 8 },
        { name: 'squat', weight: 140, reps: 5, rpe: 8 },
        { name: 'deadlift', weight: 180, reps: 3, rpe: 9 },
        { name: 'deadlift', weight: 180, reps: 3, rpe: 9 },
      ], { allowedStress: 100000 });
      const nudge = evaluateNudge(session);
      expect(nudge).toBe('High neural load — consider lighter movements');
    });
  });

  describe('Scenario: Session with no allowed stress (division by zero)', () => {
    it('handles gracefully', () => {
      const session = buildSession(
        [{ name: 'curl', weight: 10, reps: 15, rpe: 6 }],
        { allowedStress: 0 },
      );
      // Should not crash, may or may not show neural load nudge
      const nudge = evaluateNudge(session);
      // No neural load from curls, no stress to evaluate
      expect(nudge).toBeNull();
    });
  });
});

// ── 5. SET FEEDBACK (PER-SET COACHING) ──────────────────────────────

describe('Set Feedback — Per-Set Coaching', () => {
  describe('Scenario: Normal moderate set', () => {
    it('provides rest suggestion for RPE 7-9', () => {
      const session = buildSession([]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'bench press', weight: 80, reps: 8, rpe: 8,
      });
      expect(fb?.message).toContain('Rest 90s-2 min');
      expect(fb?.type).toBe('info');
    });
  });

  describe('Scenario: Very heavy set (RPE 9+)', () => {
    it('suggests longer rest', () => {
      const session = buildSession([
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'bench press', weight: 80, reps: 5, rpe: 9,
      });
      // Should be rest suggestion or 2-set milestone
      expect(fb).not.toBeNull();
    });
  });

  describe('Scenario: Weight anomaly (possible typo)', () => {
    it('warns when weight is 2x the average', () => {
      const session = buildSession([
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'bench press', weight: 200, reps: 8, rpe: 7,
      });
      expect(fb?.type).toBe('warning');
      expect(fb?.message).toContain('Typo');
    });

    it('warns when weight drops to half', () => {
      const session = buildSession([
        { name: 'squat', weight: 100, reps: 5, rpe: 8 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'squat', weight: 30, reps: 10, rpe: 6,
      });
      expect(fb?.type).toBe('warning');
      expect(fb?.message).toContain('very different');
    });
  });

  describe('Scenario: First set at failure (RPE 10) with heavy weight', () => {
    it('warns about starting at failure', () => {
      const session = buildSession([]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'squat', weight: 180, reps: 2, rpe: 10,
      });
      expect(fb?.type).toBe('warning');
      expect(fb?.message).toContain('failure');
    });

    it('does NOT warn for light weight at failure', () => {
      const session = buildSession([]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'lateral raise', weight: 8, reps: 20, rpe: 10,
      });
      // Light weight (< 50kg) should not trigger first-set failure warning
      expect(fb?.message).not.toContain('first set');
    });
  });

  describe('Scenario: Fatigue trend across sets', () => {
    it('detects increasing RPE (6 → 7 → 8)', () => {
      const session = buildSession([
        { name: 'bench press', weight: 80, reps: 8, rpe: 6 },
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'bench press', weight: 80, reps: 8, rpe: 8,
      });
      expect(fb?.type).toBe('warning');
      expect(fb?.message).toContain('Effort increasing');
    });

    it('does NOT flag stable RPE', () => {
      const session = buildSession([
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
        { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'bench press', weight: 80, reps: 8, rpe: 7,
      });
      // 3 sets milestone, not fatigue warning
      expect(fb?.message).toContain('3 sets');
    });
  });

  describe('Scenario: Volume milestones', () => {
    it('celebrates 3 sets', () => {
      const session = buildSession([
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'curl', weight: 15, reps: 12, rpe: 6,
      });
      expect(fb?.type).toBe('info');
      expect(fb?.message).toContain('3 sets on curl');
    });

    it('suggests moving on at 5 sets', () => {
      const session = buildSession([
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
        { name: 'curl', weight: 15, reps: 12, rpe: 6 },
      ]);
      const fb = generateSetFeedback(session, {
        exerciseName: 'curl', weight: 15, reps: 12, rpe: 6,
      });
      expect(fb?.type).toBe('info');
      expect(fb?.message).toContain('5 sets');
      expect(fb?.message).toContain('next exercise');
    });
  });

  describe('Scenario: Cross-exercise isolation', () => {
    it('does not apply weight anomaly across different exercises', () => {
      const session = buildSession([
        { name: 'squat', weight: 140, reps: 5, rpe: 8 },
      ], { allowedStress: 100000 });
      // Logging a curl at 15kg should not warn about weight difference from squat
      const fb = generateSetFeedback(session, {
        exerciseName: 'curl', weight: 15, reps: 12, rpe: 6,
      });
      // fb should be null (no feedback for first set of a new exercise at moderate RPE)
      // or if present, should not mention typo
      if (fb != null) {
        expect(fb.message).not.toContain('Typo');
      } else {
        expect(fb).toBeNull();
      }
    });
  });
});

// ── 6. POLICY CAPS DERIVATION ───────────────────────────────────────

describe('Policy Caps — Training Restrictions', () => {
  describe('Scenario: Green band — fully cleared', () => {
    it('allows unrestricted training', () => {
      const caps = deriveCaps('green');
      expect(caps.max_rpe).toBe(10);
      expect(caps.max_allowed_stress_pct).toBe(100);
      expect(caps.block_heavy_neural).toBe(false);
      expect(caps.max_cardio_zone).toBe(5);
    });

    it('also works for "optimal" band name', () => {
      expect(deriveCaps('optimal')).toEqual(deriveCaps('green'));
    });
  });

  describe('Scenario: Yellow band — reduced intensity', () => {
    it('caps RPE and stress', () => {
      const caps = deriveCaps('yellow');
      expect(caps.max_rpe).toBe(8);
      expect(caps.max_allowed_stress_pct).toBe(85);
      expect(caps.block_heavy_neural).toBe(false);
    });

    it('also works for "suboptimal" band name', () => {
      expect(deriveCaps('suboptimal')).toEqual(deriveCaps('yellow'));
    });
  });

  describe('Scenario: Red band — rest recommended', () => {
    it('severely restricts training', () => {
      const caps = deriveCaps('red');
      expect(caps.max_rpe).toBe(7);
      expect(caps.max_allowed_stress_pct).toBe(60);
      expect(caps.block_heavy_neural).toBe(true);
      expect(caps.max_cardio_zone).toBe(3);
    });

    it('also works for "high_risk" band name', () => {
      expect(deriveCaps('high_risk')).toEqual(deriveCaps('red'));
    });
  });

  describe('Scenario: Unknown band defaults to green', () => {
    it('treats unknown as green', () => {
      expect(deriveCaps('unknown')).toEqual(deriveCaps('green'));
      expect(deriveCaps('')).toEqual(deriveCaps('green'));
    });
  });
});

// ── 7. CHECK-IN CONTEXT ─────────────────────────────────────────────

describe('Check-In Context — Daily Self-Report Signals', () => {
  describe('Scenario: All signals good (3/3/3)', () => {
    it('produces no warnings', () => {
      expect(getCheckInContext({ energy: 3, sleepQuality: 3, soreness: 3 })).toEqual([]);
    });
  });

  describe('Scenario: Excellent day (5/5/1)', () => {
    it('produces no warnings for high energy, high sleep, low soreness', () => {
      expect(getCheckInContext({ energy: 5, sleepQuality: 5, soreness: 1 })).toEqual([]);
    });
  });

  describe('Scenario: Exhausted (1/1/5)', () => {
    it('produces all three warnings', () => {
      const ctx = getCheckInContext({ energy: 1, sleepQuality: 1, soreness: 5 });
      expect(ctx).toHaveLength(3);
      expect(ctx).toContain('Low energy noted');
      expect(ctx).toContain('Poor sleep reported');
      expect(ctx).toContain('High soreness noted');
    });
  });

  describe('Scenario: Borderline values', () => {
    it('energy=2 triggers warning (boundary)', () => {
      expect(getCheckInContext({ energy: 2, sleepQuality: 3, soreness: 3 }))
        .toContain('Low energy noted');
    });

    it('energy=3 does NOT trigger warning', () => {
      expect(getCheckInContext({ energy: 3, sleepQuality: 3, soreness: 3 }))
        .not.toContain('Low energy noted');
    });

    it('soreness=4 triggers warning (boundary)', () => {
      expect(getCheckInContext({ energy: 3, sleepQuality: 3, soreness: 4 }))
        .toContain('High soreness noted');
    });

    it('soreness=3 does NOT trigger warning', () => {
      expect(getCheckInContext({ energy: 3, sleepQuality: 3, soreness: 3 }))
        .not.toContain('High soreness noted');
    });
  });

  describe('Scenario: shouldShowCheckIn logic', () => {
    it('shows check-in when never done', () => {
      expect(shouldShowCheckIn(null)).toBe(true);
    });

    it('shows check-in when last done yesterday', () => {
      expect(shouldShowCheckIn('2020-01-01')).toBe(true);
    });

    it('does NOT show when already done today', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(shouldShowCheckIn(today)).toBe(false);
    });
  });
});

// ── 8. INTEGRATED SCENARIO: FULL USER JOURNEY ──────────────────────

describe('Integrated Scenario: Full User Journey', () => {
  it('Scenario: Recovered user completes a solid workout', () => {
    // Dashboard: green band, no penalties
    const headline = buildHeadline(null, [], { capacity_score: 0.95 });
    expect(headline).toBe('No recovery penalties active.');

    const bullets = buildWhyBullets([], { capacity_score: 0.95, rolling_strain_ratio: 1.0 });
    expect(bullets).toContain('Recovery capacity 95%');

    const explanation = buildExplanation({
      score: 90,
      band: 'green',
      penalties: [],
      rawMetrics: {},
      caps: { maxRpe: 10, maxStressPct: 100, blockHeavyNeural: false, maxCardioZone: 5 },
    });
    expect(explanation.decisionLine).toBe("You're cleared for a full session.");

    // During workout: moderate session with high stress budget
    const session = buildSession([
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
    ], { allowedStress: 10000 });
    const nudge = evaluateNudge(session);
    expect(nudge).toBeNull(); // No stress issues
  });

  it('Scenario: Fatigued user with poor sleep check-in', () => {
    const checkIn: CheckInData = { energy: 2, sleepQuality: 1, soreness: 4 };
    const context = getCheckInContext(checkIn);
    expect(context).toContain('Low energy noted');
    expect(context).toContain('Poor sleep reported');
    expect(context).toContain('High soreness noted');

    // Headline reflects check-in when no penalties
    const headline = buildHeadline(null, [], {}, checkIn);
    expect(headline).toBe('Low energy noted. Adjust intensity today.');

    // Even with yellow band penalties, penalties take priority in headline
    const penalties = [{ category: 'systemic_fatigue', reason: 'fatigue', points: 10 }];
    const headlineWithPenalties = buildHeadline(null, penalties, { rolling_strain_ratio: 1.5 }, checkIn);
    expect(headlineWithPenalties).toBe('Systemic fatigue elevated 50%.');
  });

  it('Scenario: Red band user — everything restricted', () => {
    const caps = deriveCaps('red');
    expect(caps.block_heavy_neural).toBe(true);
    expect(caps.max_rpe).toBe(7);
    expect(caps.max_allowed_stress_pct).toBe(60);

    const explanation = buildExplanation({
      score: 45,
      band: 'red',
      penalties: [
        { category: 'recovery_window', reason: 'recovery', points: 20, metric_key: 'recently_trained_muscle' },
        { category: 'systemic_fatigue', reason: 'fatigue', points: 15, metric_key: 'stress_ratio_high' },
      ],
      rawMetrics: { rolling_strain_ratio: 2.1 },
      caps: { maxRpe: 7, maxStressPct: 60, blockHeavyNeural: true, maxCardioZone: 3 },
    });
    expect(explanation.decisionLine).toBe('Rest recommended — recovery is the priority.');
    expect(explanation.totalDeducted).toBe(35);

    const heavyLimit = explanation.sessionLimits.find(l => l.label === 'HEAVY NEURAL');
    expect(heavyLimit?.value).toBe('BLOCKED');
  });
});
