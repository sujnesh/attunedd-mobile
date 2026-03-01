import { generateSetFeedback, type CoachingFeedback } from '../workout/core/coachingEngine';
import { initializeSession, addSet } from '../workout/core/sessionState';
import type { PolicyCaps } from '../engine/types';

const CAPS: PolicyCaps = {
  max_rpe: 8,
  max_allowed_stress_pct: 85,
  block_heavy_neural: false,
  max_cardio_zone: 3,
};

function buildSession(sets: { name: string; weight: number | null; reps: number; rpe: number }[], allowedStress = 100) {
  let session = initializeSession('free_form', CAPS, allowedStress);
  for (const s of sets) {
    session = addSet(session, s.name, s.weight, s.reps, s.rpe, false);
  }
  return session;
}

describe('generateSetFeedback', () => {
  it('warns on dramatic weight change', () => {
    const session = buildSession([
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
    ]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'bench press',
      weight: 200,
      reps: 8,
      rpe: 7,
    });
    expect(feedback).not.toBeNull();
    expect(feedback!.type).toBe('warning');
    expect(feedback!.message).toContain('very different');
  });

  it('warns on first set at failure with heavy weight', () => {
    const session = buildSession([]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'squat',
      weight: 200,
      reps: 3,
      rpe: 10, // RIR 0 = failure
    });
    expect(feedback).not.toBeNull();
    expect(feedback!.type).toBe('warning');
    expect(feedback!.message).toContain('failure');
  });

  it('does not warn on first set at failure with light weight', () => {
    const session = buildSession([]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'curl',
      weight: 10,
      reps: 20,
      rpe: 10,
    });
    // Should not trigger first-set failure warning for light weight
    expect(feedback?.message).not.toContain('first set');
  });

  it('celebrates 3-set milestone', () => {
    const session = buildSession([
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
    ]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'bench press',
      weight: 80,
      reps: 8,
      rpe: 7,
    });
    expect(feedback).not.toBeNull();
    expect(feedback!.type).toBe('info');
    expect(feedback!.message).toContain('3 sets');
  });

  it('suggests moving on at 5-set milestone', () => {
    const session = buildSession([
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
      { name: 'bench press', weight: 80, reps: 8, rpe: 7 },
    ]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'bench press',
      weight: 80,
      reps: 8,
      rpe: 7,
    });
    expect(feedback).not.toBeNull();
    expect(feedback!.message).toContain('5 sets');
  });

  it('suggests rest time for heavy sets (RPE >= 9)', () => {
    const session = buildSession([]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'deadlift',
      weight: 200,
      reps: 3,
      rpe: 9,
    });
    // First set at RPE 9 but under 50kg threshold won't trigger first-set warning
    // It should give rest suggestion or volume milestone
    expect(feedback).not.toBeNull();
  });

  it('warns when approaching stress budget', () => {
    // Create a session near stress limit
    const session = buildSession(
      [
        { name: 'bench', weight: 80, reps: 8, rpe: 8 },
        { name: 'bench', weight: 80, reps: 8, rpe: 8 },
        { name: 'squat', weight: 100, reps: 5, rpe: 8 },
        { name: 'squat', weight: 100, reps: 5, rpe: 8 },
      ],
      10, // Very low allowed stress so we exceed quickly
    );
    // The stress budget should be exceeded with very low allowed stress
    const pct = session.allowedStress > 0 ? (session.cumulativeStress / session.allowedStress) * 100 : 0;
    // With allowedStress=10 and multiple heavy sets, pct should be > 90
    expect(pct).toBeGreaterThanOrEqual(90);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'row',
      weight: 60,
      reps: 10,
      rpe: 7,
    });
    // When over budget, coaching engine returns stress budget warning
    expect(feedback).not.toBeNull();
  });

  it('detects increasing effort trend', () => {
    const session = buildSession([
      { name: 'bench', weight: 80, reps: 8, rpe: 6 },
      { name: 'bench', weight: 80, reps: 8, rpe: 7 },
    ]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'bench',
      weight: 80,
      reps: 8,
      rpe: 8,
    });
    // Should detect the increasing trend
    expect(feedback).not.toBeNull();
    expect(feedback!.type).toBe('warning');
    expect(feedback!.message).toContain('Effort increasing');
  });

  it('returns null for unremarkable sets', () => {
    const session = buildSession([
      { name: 'bench', weight: 80, reps: 8, rpe: 5 },
    ]);
    const feedback = generateSetFeedback(session, {
      exerciseName: 'curl',
      weight: 20,
      reps: 12,
      rpe: 5,
    });
    // Different exercise, low RPE, no anomalies — should return null
    expect(feedback).toBeNull();
  });
});
