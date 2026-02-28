import { computeDelta } from '../state/deltaEngine';
import type { EvaluationSnapshot, PolicyCaps } from '../state/evaluationEngine';

function makeSnapshot(overrides: Partial<EvaluationSnapshot> = {}): EvaluationSnapshot {
  return {
    adaptation_score: 75,
    risk_band: 'green',
    caps: {
      max_rpe: 10,
      max_allowed_stress_pct: 100,
      block_heavy_neural: false,
      max_cardio_zone: 5,
    },
    caps_hash: 'abc12345',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('computeDelta', () => {
  it('does not notify on first evaluation (previous is null)', () => {
    const current = makeSnapshot();
    const result = computeDelta(current, null);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe('');
  });

  it('notifies when risk band changes', () => {
    const previous = makeSnapshot({ risk_band: 'green' });
    const current = makeSnapshot({ risk_band: 'yellow' });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('Risk band changed');
    expect(result.reason).toContain('green');
    expect(result.reason).toContain('yellow');
  });

  it('notifies when score changes by exactly 8', () => {
    const previous = makeSnapshot({ adaptation_score: 70 });
    const current = makeSnapshot({ adaptation_score: 78 });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('increased');
    expect(result.reason).toContain('8');
  });

  it('notifies when score decreases by >= 8', () => {
    const previous = makeSnapshot({ adaptation_score: 80 });
    const current = makeSnapshot({ adaptation_score: 70 });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('decreased');
    expect(result.reason).toContain('10');
  });

  it('does not notify when score changes by less than 8', () => {
    const previous = makeSnapshot({ adaptation_score: 70 });
    const current = makeSnapshot({ adaptation_score: 77 });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(false);
  });

  it('notifies when RPE cap is reduced', () => {
    const previous = makeSnapshot({
      caps: { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const current = makeSnapshot({
      caps: { max_rpe: 8, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('RPE cap reduced');
  });

  it('does not notify when RPE cap increases', () => {
    const previous = makeSnapshot({
      caps: { max_rpe: 7, max_allowed_stress_pct: 70, block_heavy_neural: true, max_cardio_zone: 3 },
    });
    const current = makeSnapshot({
      caps: { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(false);
  });

  it('notifies when stress cap is reduced', () => {
    const previous = makeSnapshot({
      caps: { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const current = makeSnapshot({
      caps: { max_rpe: 10, max_allowed_stress_pct: 85, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('Stress cap reduced');
  });

  it('notifies when heavy neural block is newly enabled', () => {
    const previous = makeSnapshot({
      caps: { max_rpe: 10, max_allowed_stress_pct: 100, block_heavy_neural: false, max_cardio_zone: 5 },
    });
    const current = makeSnapshot({
      caps: { max_rpe: 7, max_allowed_stress_pct: 60, block_heavy_neural: true, max_cardio_zone: 3 },
    });
    const result = computeDelta(current, previous);
    // Risk band change will fire first since it takes priority
    expect(result.shouldNotify).toBe(true);
  });

  it('does not notify when nothing changes', () => {
    const snapshot = makeSnapshot();
    const result = computeDelta(snapshot, snapshot);
    expect(result.shouldNotify).toBe(false);
  });

  it('risk band change takes priority over score change', () => {
    const previous = makeSnapshot({ adaptation_score: 75, risk_band: 'green' });
    const current = makeSnapshot({ adaptation_score: 35, risk_band: 'red' });
    const result = computeDelta(current, previous);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toContain('Risk band changed');
  });
});
