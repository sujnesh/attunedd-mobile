import { buildExplanation, type ExplanationInput } from '../services/explanationEngine';
import type { PenaltyItem } from '../types/api';
import type { ParsedCaps } from '../services/metaStateService';

function defaultCaps(overrides: Partial<ParsedCaps> = {}): ParsedCaps {
  return {
    maxRpe: 10,
    maxStressPct: 100,
    blockHeavyNeural: false,
    maxCardioZone: 5,
    ...overrides,
  };
}

function defaultInput(overrides: Partial<ExplanationInput> = {}): ExplanationInput {
  return {
    score: 100,
    band: 'green',
    penalties: [],
    rawMetrics: {},
    caps: defaultCaps(),
    ...overrides,
  };
}

function penalty(overrides: Partial<PenaltyItem> = {}): PenaltyItem {
  return {
    category: 'recovery_window',
    points: 10,
    reason: 'Chest trained within 48h',
    metric_key: 'recently_trained_muscle',
    ...overrides,
  };
}

describe('buildExplanation', () => {
  describe('decision line', () => {
    it('returns green decision line', () => {
      const result = buildExplanation(defaultInput({ band: 'green' }));
      expect(result.decisionLine).toBe("You're cleared for a full session.");
    });

    it('returns yellow decision line', () => {
      const result = buildExplanation(defaultInput({ band: 'yellow' }));
      expect(result.decisionLine).toBe('Train with reduced intensity today.');
    });

    it('returns red decision line', () => {
      const result = buildExplanation(defaultInput({ band: 'red' }));
      expect(result.decisionLine).toBe('Rest recommended — recovery is the priority.');
    });

    it('falls back to yellow for unknown band', () => {
      const result = buildExplanation(defaultInput({ band: 'unknown' }));
      expect(result.decisionLine).toBe('Train with reduced intensity today.');
    });
  });

  describe('penalty category mapping', () => {
    const cases: [string, string, string][] = [
      ['recovery_window', 'Recovery', '↻'],
      ['systemic_fatigue', 'Fatigue', '▼'],
      ['load_management', 'Load', '◆'],
      ['stimulus_balance', 'Balance', '⚖'],
      ['override_behavior', 'Overrides', '⚠'],
    ];

    it.each(cases)('maps %s to label=%s icon=%s', (category, label, icon) => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ category })],
        })
      );
      expect(result.penaltyBreakdown[0].category).toBe(label);
      expect(result.penaltyBreakdown[0].icon).toBe(icon);
    });

    it('falls back to Other for unknown category', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ category: 'future_category' })],
        })
      );
      expect(result.penaltyBreakdown[0].category).toBe('Other');
      expect(result.penaltyBreakdown[0].icon).toBe('•');
    });
  });

  describe('metric_key description formatting', () => {
    it('formats recently_trained_muscle', () => {
      const result = buildExplanation(
        defaultInput({ penalties: [penalty({ metric_key: 'recently_trained_muscle' })] })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Same muscle group trained within 48 hours');
    });

    it('formats heavy_neural_48h', () => {
      const result = buildExplanation(
        defaultInput({ penalties: [penalty({ metric_key: 'heavy_neural_48h' })] })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Heavy compound lift done within 48 hours');
    });

    it('formats low_capacity with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'low_capacity', category: 'systemic_fatigue' })],
          rawMetrics: { capacity_score: 0.68 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Recovery capacity very low (68%)');
    });

    it('formats reduced_capacity with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'reduced_capacity', category: 'systemic_fatigue' })],
          rawMetrics: { capacity_score: 0.82 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Recovery capacity reduced (82%)');
    });

    it('formats session_fatigue', () => {
      const result = buildExplanation(
        defaultInput({ penalties: [penalty({ metric_key: 'session_fatigue', category: 'systemic_fatigue' })] })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Fatigue detected during current session');
    });

    it('formats stress_ratio_high with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'stress_ratio_high', category: 'load_management' })],
          rawMetrics: { rolling_strain_ratio: 1.35 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Training load significantly elevated (1.35x baseline)');
    });

    it('formats stress_ratio_elevated with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'stress_ratio_elevated', category: 'load_management' })],
          rawMetrics: { rolling_strain_ratio: 1.18 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Training load moderately elevated (1.18x baseline)');
    });

    it('formats overtrained_muscle', () => {
      const result = buildExplanation(
        defaultInput({ penalties: [penalty({ metric_key: 'overtrained_muscle', category: 'stimulus_balance' })] })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Muscle group already exceeds weekly target');
    });

    it('formats deficit_avoidance', () => {
      const result = buildExplanation(
        defaultInput({ penalties: [penalty({ metric_key: 'deficit_avoidance', category: 'stimulus_balance' })] })
      );
      expect(result.penaltyBreakdown[0].description).toBe("Session doesn't address undertrained muscle groups");
    });

    it('formats overrides_14d with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'overrides_14d', category: 'override_behavior' })],
          rawMetrics: { overrides_14d: 3 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('3 rest overrides in the past 14 days');
    });

    it('formats overrides_7d with value', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'overrides_7d', category: 'override_behavior' })],
          rawMetrics: { overrides_7d: 2 },
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('2 rest overrides in the past 7 days');
    });

    it('falls back to penalty.reason for unknown metric_key', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [penalty({ metric_key: 'future_metric', reason: 'Some future reason' })],
        })
      );
      expect(result.penaltyBreakdown[0].description).toBe('Some future reason');
    });
  });

  describe('session limits', () => {
    it('derives limits from optimal caps', () => {
      const result = buildExplanation(defaultInput());
      expect(result.sessionLimits).toEqual([
        { label: 'MAX RPE', value: '10', restricted: false },
        { label: 'STRESS', value: '100%', restricted: false },
        { label: 'HEAVY NEURAL', value: 'OK', restricted: false },
        { label: 'MAX ZONE', value: 'Z5', restricted: false },
      ]);
    });

    it('derives limits from restricted caps', () => {
      const result = buildExplanation(
        defaultInput({
          caps: defaultCaps({ maxRpe: 7, maxStressPct: 60, blockHeavyNeural: true, maxCardioZone: 3 }),
        })
      );
      expect(result.sessionLimits).toEqual([
        { label: 'MAX RPE', value: '7', restricted: true },
        { label: 'STRESS', value: '60%', restricted: true },
        { label: 'HEAVY NEURAL', value: 'BLOCKED', restricted: true },
        { label: 'MAX ZONE', value: 'Z3', restricted: true },
      ]);
    });
  });

  describe('hasServerData', () => {
    it('is true when penalties are non-empty', () => {
      const result = buildExplanation(defaultInput({ penalties: [penalty()] }));
      expect(result.hasServerData).toBe(true);
    });

    it('is false when penalties are empty', () => {
      const result = buildExplanation(defaultInput({ penalties: [] }));
      expect(result.hasServerData).toBe(false);
    });
  });

  describe('totalDeducted', () => {
    it('equals sum of penalty points', () => {
      const result = buildExplanation(
        defaultInput({
          score: 74,
          band: 'yellow',
          penalties: [
            penalty({ points: 10 }),
            penalty({ points: 8, metric_key: 'reduced_capacity', category: 'systemic_fatigue' }),
            penalty({ points: 8, metric_key: 'session_fatigue', category: 'systemic_fatigue' }),
          ],
        })
      );
      expect(result.totalDeducted).toBe(26);
    });

    it('is 0 for empty penalties', () => {
      const result = buildExplanation(defaultInput());
      expect(result.totalDeducted).toBe(0);
    });
  });

  describe('penaltyBreakdown ordering', () => {
    it('sorts by points descending', () => {
      const result = buildExplanation(
        defaultInput({
          penalties: [
            penalty({ points: 6, metric_key: 'deficit_avoidance', category: 'stimulus_balance' }),
            penalty({ points: 15, metric_key: 'low_capacity', category: 'systemic_fatigue' }),
            penalty({ points: 10, metric_key: 'recently_trained_muscle' }),
          ],
        })
      );
      expect(result.penaltyBreakdown.map((r) => r.points)).toEqual([15, 10, 6]);
    });
  });

  describe('empty penalties', () => {
    it('returns empty breakdown', () => {
      const result = buildExplanation(defaultInput());
      expect(result.penaltyBreakdown).toEqual([]);
    });
  });

  describe('invariant validation', () => {
    it('totalDeducted matches 100 - score for server data', () => {
      const penalties = [
        penalty({ points: 10 }),
        penalty({ points: 8, metric_key: 'reduced_capacity', category: 'systemic_fatigue' }),
      ];
      const score = 82;
      const result = buildExplanation(defaultInput({ score, penalties }));
      expect(result.totalDeducted).toBe(100 - score);
    });
  });
});
