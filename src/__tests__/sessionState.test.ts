import {
  initializeSession,
  addSet,
  removeLastSet,
  isHeavyNeural,
  getNeuralLoadStatus,
  getRecentSetsForExercise,
  serialize,
  deserialize,
} from '../workout/core/sessionState';
import type { PolicyCaps } from '../engine/types';

const CAPS: PolicyCaps = {
  max_rpe: 8,
  max_allowed_stress_pct: 85,
  block_heavy_neural: false,
  max_cardio_zone: 3,
};

describe('initializeSession', () => {
  it('creates session with correct defaults', () => {
    const session = initializeSession('planned', CAPS, 100);
    expect(session.mode).toBe('planned');
    expect(session.caps).toEqual(CAPS);
    expect(session.allowedStress).toBe(100);
    expect(session.sets).toEqual([]);
    expect(session.cumulativeStress).toBe(0);
    expect(session.startedAt).toBeGreaterThan(0);
  });

  it('supports free_form mode', () => {
    const session = initializeSession('free_form', CAPS, 50);
    expect(session.mode).toBe('free_form');
  });
});

describe('addSet', () => {
  it('adds a set and increments cumulative stress', () => {
    const session = initializeSession('planned', CAPS, 100);
    const updated = addSet(session, 'bench press', 135, 5, 7, false);

    expect(updated.sets.length).toBe(1);
    expect(updated.sets[0].exerciseName).toBe('bench press');
    expect(updated.sets[0].weight).toBe(135);
    expect(updated.sets[0].reps).toBe(5);
    expect(updated.sets[0].rpe).toBe(7);
    expect(updated.sets[0].setNumber).toBe(1);
    expect(updated.sets[0].capOverride).toBe(false);
    expect(updated.cumulativeStress).toBeGreaterThan(0);
  });

  it('increments set number per exercise', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'squat', 225, 5, 8, false);
    session = addSet(session, 'squat', 225, 5, 8, false);
    session = addSet(session, 'bench press', 135, 5, 7, false);

    expect(session.sets[0].setNumber).toBe(1); // squat #1
    expect(session.sets[1].setNumber).toBe(2); // squat #2
    expect(session.sets[2].setNumber).toBe(1); // bench #1
  });

  it('handles null weight', () => {
    const session = initializeSession('planned', CAPS, 100);
    const updated = addSet(session, 'pullup', null, 10, 7, false);
    expect(updated.sets[0].weight).toBeNull();
  });

  it('marks cap overrides', () => {
    const session = initializeSession('planned', CAPS, 100);
    const updated = addSet(session, 'deadlift', 315, 3, 9, true);
    expect(updated.sets[0].capOverride).toBe(true);
  });

  it('does not mutate original state', () => {
    const session = initializeSession('planned', CAPS, 100);
    const updated = addSet(session, 'squat', 225, 5, 8, false);
    expect(session.sets.length).toBe(0);
    expect(updated.sets.length).toBe(1);
  });
});

describe('removeLastSet', () => {
  it('removes the last set and subtracts stress', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'bench press', 135, 5, 7, false);
    const stressAfterAdd = session.cumulativeStress;

    session = addSet(session, 'bench press', 135, 5, 8, false);
    expect(session.sets.length).toBe(2);

    const updated = removeLastSet(session);
    expect(updated.sets.length).toBe(1);
    expect(updated.cumulativeStress).toBe(stressAfterAdd);
  });

  it('returns same state when no sets', () => {
    const session = initializeSession('planned', CAPS, 100);
    const updated = removeLastSet(session);
    expect(updated).toBe(session);
  });

  it('does not mutate original state', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'squat', 225, 5, 8, false);
    const updated = removeLastSet(session);
    expect(session.sets.length).toBe(1);
    expect(updated.sets.length).toBe(0);
  });
});

describe('isHeavyNeural', () => {
  it('identifies heavy neural exercises', () => {
    expect(isHeavyNeural('deadlift')).toBe(true);
    expect(isHeavyNeural('squat')).toBe(true);
    expect(isHeavyNeural('bench press')).toBe(true);
    expect(isHeavyNeural('Deadlift')).toBe(true); // case insensitive
  });

  it('rejects non-heavy exercises', () => {
    expect(isHeavyNeural('curl')).toBe(false);
    expect(isHeavyNeural('lateral raise')).toBe(false);
  });
});

describe('getNeuralLoadStatus', () => {
  it('returns none when no heavy exercises', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'curl', 25, 12, 7, false);
    expect(getNeuralLoadStatus(session)).toBe('none');
  });

  it('returns moderate for 1-3 heavy sets', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'deadlift', 315, 3, 8, false);
    session = addSet(session, 'squat', 225, 5, 8, false);
    expect(getNeuralLoadStatus(session)).toBe('moderate');
  });

  it('returns high for 4+ heavy sets', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'deadlift', 315, 3, 8, false);
    session = addSet(session, 'deadlift', 315, 3, 8, false);
    session = addSet(session, 'squat', 225, 5, 8, false);
    session = addSet(session, 'squat', 225, 5, 8, false);
    expect(getNeuralLoadStatus(session)).toBe('high');
  });
});

describe('getRecentSetsForExercise', () => {
  it('returns last N sets for an exercise in reverse order', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'bench press', 135, 5, 7, false);
    session = addSet(session, 'bench press', 145, 5, 8, false);
    session = addSet(session, 'bench press', 155, 3, 9, false);

    const recent = getRecentSetsForExercise(session, 'bench press', 2);
    expect(recent.length).toBe(2);
    expect(recent[0].weight).toBe(155); // most recent first
    expect(recent[1].weight).toBe(145);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips session state', () => {
    let session = initializeSession('planned', CAPS, 100);
    session = addSet(session, 'squat', 225, 5, 8, false);

    const json = serialize(session);
    const restored = deserialize(json);

    expect(restored.mode).toBe('planned');
    expect(restored.sets.length).toBe(1);
    expect(restored.sets[0].exerciseName).toBe('squat');
    expect(restored.cumulativeStress).toBe(session.cumulativeStress);
  });
});
