import { detectPlannedFatigue, detectFreeFormFatigue } from '../engine/fatigue';
import type { SetData } from '../engine/types';

describe('detectPlannedFatigue', () => {
  it('returns false with fewer than 2 sets', () => {
    expect(detectPlannedFatigue([{ rpe: 10, reps: 3 }], 7, '8-10')).toBe(false);
  });

  it('returns false with empty sets', () => {
    expect(detectPlannedFatigue([], 7, '8-10')).toBe(false);
  });

  it('triggers when both sets exceed RPE+1 AND reps below midpoint', () => {
    // plannedRpe=7, plannedRepRange="8-10" -> midpoint=9, threshold RPE=8
    // Both sets: rpe >= 8 AND reps < 9
    const sets: SetData[] = [
      { rpe: 9, reps: 6 },
      { rpe: 8, reps: 7 },
    ];
    expect(detectPlannedFatigue(sets, 7, '8-10')).toBe(true);
  });

  it('does not trigger when RPE is exactly plannedRpe+1 but reps >= midpoint', () => {
    // midpoint=9, threshold=8
    const sets: SetData[] = [
      { rpe: 8, reps: 9 },
      { rpe: 9, reps: 7 },
    ];
    expect(detectPlannedFatigue(sets, 7, '8-10')).toBe(false);
  });

  it('does not trigger when RPE below threshold', () => {
    // threshold RPE = 7+1 = 8
    const sets: SetData[] = [
      { rpe: 7, reps: 5 },
      { rpe: 7, reps: 4 },
    ];
    expect(detectPlannedFatigue(sets, 7, '8-10')).toBe(false);
  });

  it('does not trigger when only one set meets criteria', () => {
    const sets: SetData[] = [
      { rpe: 9, reps: 5 },  // meets both
      { rpe: 7, reps: 5 },  // RPE too low
    ];
    expect(detectPlannedFatigue(sets, 7, '8-10')).toBe(false);
  });

  it('defaults plannedRpe to 7.0 when 0', () => {
    // effectiveRpe=7, threshold=8, midpoint("6-12")=9
    const sets: SetData[] = [
      { rpe: 9, reps: 6 },
      { rpe: 8, reps: 7 },
    ];
    expect(detectPlannedFatigue(sets, 0, '6-12')).toBe(true);
  });

  it('only checks first 2 sets (newest-first)', () => {
    const sets: SetData[] = [
      { rpe: 6, reps: 10 },  // newest - does not meet
      { rpe: 6, reps: 10 },  // second newest - does not meet
      { rpe: 10, reps: 3 },  // third - ignored
      { rpe: 10, reps: 2 },  // fourth - ignored
    ];
    expect(detectPlannedFatigue(sets, 7, '8-10')).toBe(false);
  });
});

describe('detectFreeFormFatigue', () => {
  it('returns false with fewer than 2 sets', () => {
    expect(detectFreeFormFatigue([{ rpe: 10, reps: 3 }])).toBe(false);
  });

  it('returns false with empty sets', () => {
    expect(detectFreeFormFatigue([])).toBe(false);
  });

  it('triggers when both sets RPE >= 9 and reps decreasing', () => {
    // newer (index 0): rpe=9, reps=5
    // older (index 1): rpe=9, reps=8
    // newer.reps < older.reps -> true
    const sets: SetData[] = [
      { rpe: 9, reps: 5 },
      { rpe: 9, reps: 8 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(true);
  });

  it('does not trigger when reps are equal', () => {
    const sets: SetData[] = [
      { rpe: 10, reps: 5 },
      { rpe: 10, reps: 5 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(false);
  });

  it('does not trigger when reps are increasing', () => {
    const sets: SetData[] = [
      { rpe: 9, reps: 10 },
      { rpe: 9, reps: 8 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(false);
  });

  it('does not trigger when one set RPE < 9', () => {
    const sets: SetData[] = [
      { rpe: 9, reps: 5 },
      { rpe: 8, reps: 8 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(false);
  });

  it('does not trigger when both RPE < 9 even if reps decreasing', () => {
    const sets: SetData[] = [
      { rpe: 8, reps: 5 },
      { rpe: 8, reps: 8 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(false);
  });

  it('triggers at RPE 10 with reps decreasing', () => {
    const sets: SetData[] = [
      { rpe: 10, reps: 3 },
      { rpe: 10, reps: 5 },
    ];
    expect(detectFreeFormFatigue(sets)).toBe(true);
  });
});
