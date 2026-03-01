import React from 'react';
import { render } from '@testing-library/react-native';
import FreeFormWorkoutScreen from '../screens/train/FreeFormWorkoutScreen';

// Mock useActiveWorkout
const mockInitSession = jest.fn();
const mockSubmitSet = jest.fn().mockResolvedValue(null);
const mockConfirmOverride = jest.fn();
const mockUndoLastSet = jest.fn();
const mockEditSet = jest.fn();
const mockDeleteSet = jest.fn();
const mockFinishSession = jest.fn();

jest.mock('../workout/controller/useActiveWorkout', () => ({
  useActiveWorkout: () => ({
    session: null,
    nudge: null,
    fatigueExercises: new Set(),
    loading: true,
    finishing: false,
    initSession: mockInitSession,
    submitSet: mockSubmitSet,
    confirmOverride: mockConfirmOverride,
    undoLastSet: mockUndoLastSet,
    editSet: mockEditSet,
    deleteSet: mockDeleteSet,
    finishSession: mockFinishSession,
  }),
}));

jest.mock('../workout/hooks/useSessionTimer', () => ({
  useSessionTimer: () => '00:00',
}));

jest.mock('../workout/core/coachingEngine', () => ({
  generateSetFeedback: jest.fn().mockReturnValue(null),
}));

jest.mock('../components/FeedbackToast', () => {
  return () => null;
});

const ROUTE = { params: { draftId: 1 } };
const NAV = { replace: jest.fn(), popToTop: jest.fn() };

describe('FreeFormWorkoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    const { toJSON } = render(
      <FreeFormWorkoutScreen route={ROUTE as any} navigation={NAV as any} />
    );
    // Should render empty view during loading
    expect(toJSON()).toBeTruthy();
  });

  it('calls initSession on mount', () => {
    render(
      <FreeFormWorkoutScreen route={ROUTE as any} navigation={NAV as any} />
    );
    expect(mockInitSession).toHaveBeenCalledWith('free_form', 1);
  });
});
