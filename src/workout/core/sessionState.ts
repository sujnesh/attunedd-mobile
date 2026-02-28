import { calculateStress } from '../../engine/stress';
import type { PolicyCaps } from '../../engine/types';

export interface SessionSet {
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number;
  rpe: number;
  stressUnits: number;
  capOverride: boolean;
  timestamp: number;
}

export interface SessionState {
  mode: 'planned' | 'free_form';
  caps: PolicyCaps;
  allowedStress: number;
  sets: SessionSet[];
  cumulativeStress: number;
  startedAt: number;
}

const HEAVY_NEURAL = new Set([
  'deadlift', 'squat', 'bench press', 'overhead press',
  'barbell row', 'power clean', 'snatch', 'clean and jerk',
  'front squat', 'romanian deadlift', 'sumo deadlift',
]);

export function isHeavyNeural(name: string): boolean {
  return HEAVY_NEURAL.has(name.toLowerCase());
}

export function initializeSession(
  mode: 'planned' | 'free_form',
  caps: PolicyCaps,
  allowedStress: number,
): SessionState {
  return {
    mode,
    caps,
    allowedStress,
    sets: [],
    cumulativeStress: 0,
    startedAt: Date.now(),
  };
}

export function addSet(
  state: SessionState,
  exerciseName: string,
  weight: number | null,
  reps: number,
  rpe: number,
  capOverride: boolean,
): SessionState {
  const stressUnits = calculateStress(weight, reps, rpe);
  const setsForExercise = state.sets.filter(s => s.exerciseName === exerciseName);
  const setNumber = setsForExercise.length + 1;

  const newSet: SessionSet = {
    exerciseName,
    setNumber,
    weight,
    reps,
    rpe,
    stressUnits,
    capOverride,
    timestamp: Date.now(),
  };

  return {
    ...state,
    sets: [...state.sets, newSet],
    cumulativeStress: state.cumulativeStress + stressUnits,
  };
}

export function removeLastSet(state: SessionState): SessionState {
  if (state.sets.length === 0) return state;
  const removed = state.sets[state.sets.length - 1];
  return {
    ...state,
    sets: state.sets.slice(0, -1),
    cumulativeStress: state.cumulativeStress - removed.stressUnits,
  };
}

export type NeuralLoadLevel = 'none' | 'moderate' | 'high';

export function getNeuralLoadStatus(state: SessionState): NeuralLoadLevel {
  const heavySets = state.sets.filter(s => isHeavyNeural(s.exerciseName)).length;
  if (heavySets === 0) return 'none';
  if (heavySets <= 3) return 'moderate';
  return 'high';
}

export function getRecentSetsForExercise(
  state: SessionState,
  exerciseName: string,
  count: number = 2,
): SessionSet[] {
  return state.sets
    .filter(s => s.exerciseName === exerciseName)
    .slice(-count)
    .reverse();
}

export function serialize(state: SessionState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): SessionState {
  return JSON.parse(json);
}
