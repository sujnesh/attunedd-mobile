import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import WorkoutHistoryScreen from '../screens/train/WorkoutHistoryScreen';

jest.mock('../services/apiClient', () => ({
  api: jest.fn(),
}));

jest.mock('../db/database', () => ({
  executeSql: jest.fn(),
}));

const { api } = require('../services/apiClient');
const { executeSql } = require('../db/database');

const NAV = { goBack: jest.fn() };

describe('WorkoutHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders HISTORY header', async () => {
    api.mockResolvedValue({ workouts: [], has_more: false, page: 1 });
    const { getByText } = render(
      <WorkoutHistoryScreen navigation={NAV as any} route={{} as any} />
    );
    await waitFor(() => {
      expect(getByText('HISTORY')).toBeTruthy();
    });
  });

  it('shows empty state when no workouts', async () => {
    api.mockResolvedValue({ workouts: [], has_more: false, page: 1 });
    const { getByText } = render(
      <WorkoutHistoryScreen navigation={NAV as any} route={{} as any} />
    );
    await waitFor(() => {
      expect(getByText('No completed workouts yet')).toBeTruthy();
    });
  });

  it('renders workout cards from server', async () => {
    api.mockResolvedValue({
      workouts: [{
        id: 1,
        status: 'completed',
        coaching_mode: 'push',
        actual_stress: 85,
        allowed_stress: 100,
        started_at: '2026-03-01T10:00:00Z',
        completed_at: '2026-03-01T11:00:00Z',
        risk_band: 'green',
        exercise_sets: [
          { exercise_name: 'Bench Press', set_number: 1, weight: 80, reps: 8, rpe: 7, stress_units: 12, cap_override: false },
          { exercise_name: 'Bench Press', set_number: 2, weight: 80, reps: 8, rpe: 8, stress_units: 14, cap_override: false },
        ],
      }],
      has_more: false,
      page: 1,
    });

    const { getByText } = render(
      <WorkoutHistoryScreen navigation={NAV as any} route={{} as any} />
    );
    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy();
      expect(getByText('PUSH')).toBeTruthy();
    });
  });

  it('falls back to local database when server fails', async () => {
    api.mockRejectedValue(new Error('network error'));
    executeSql.mockImplementation((sql: string) => {
      if (sql.includes('workout_logs')) {
        return Promise.resolve([{
          rows: {
            length: 1,
            item: (i: number) => ({
              local_id: 1,
              server_id: null,
              coaching_mode: 'free_form',
              actual_stress: 50,
              allowed_stress: 100,
              started_at: '2026-03-01T10:00:00Z',
              completed_at: '2026-03-01T11:00:00Z',
            }),
          },
        }]);
      }
      if (sql.includes('exercise_sets')) {
        return Promise.resolve([{
          rows: {
            length: 1,
            item: (i: number) => ({
              exercise_name: 'Squat',
              set_number: 1,
              weight: 100,
              reps: 5,
              rpe: 8,
              stress_units: 15,
            }),
          },
        }]);
      }
      return Promise.resolve([{ rows: { length: 0, item: jest.fn() } }]);
    });

    const { getByText } = render(
      <WorkoutHistoryScreen navigation={NAV as any} route={{} as any} />
    );
    await waitFor(() => {
      expect(getByText('Squat')).toBeTruthy();
    });
  });

  it('shows BACK button', async () => {
    api.mockResolvedValue({ workouts: [], has_more: false, page: 1 });
    const { getByText } = render(
      <WorkoutHistoryScreen navigation={NAV as any} route={{} as any} />
    );
    expect(getByText('< BACK')).toBeTruthy();
  });
});
