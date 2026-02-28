export interface OverrideEntry {
  exerciseName: string;
  violationType: string;
  timestamp: number;
}

export interface OverrideState {
  count: number;
  overrides: OverrideEntry[];
}

export function createOverrideTracker(): OverrideState {
  return { count: 0, overrides: [] };
}

export function incrementOverride(
  state: OverrideState,
  exerciseName: string,
  violationType: string,
): OverrideState {
  return {
    count: state.count + 1,
    overrides: [
      ...state.overrides,
      { exerciseName, violationType, timestamp: Date.now() },
    ],
  };
}

export function getOverrideCount(state: OverrideState): number {
  return state.count;
}
