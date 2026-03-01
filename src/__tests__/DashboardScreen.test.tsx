import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../screens/DashboardScreen';

// Mock services
jest.mock('../services/apiClient', () => ({
  apiCached: jest.fn(),
}));

jest.mock('../services/readinessService', () => ({
  loadLatestEvaluation: jest.fn(),
  triggerManualEvaluation: jest.fn(),
}));

jest.mock('../db/database', () => ({
  executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0, item: jest.fn() } }]),
}));

jest.mock('../components/InfoChip', () => {
  const { Text } = require('react-native');
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('../services/metaStateService', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn(),
}));

const { apiCached } = require('../services/apiClient');

const COACHING_RESPONSE = {
  adaptation_score: 73,
  risk_band: 'optimal',
  coaching: {
    headline: 'You\'re fully recovered. Push hard today.',
    tone: 'encouraging',
    primary_factor: null,
    nudges: ['Chest volume is on track this week.'],
    positive_notes: ['High recovery — you can afford to push today.'],
  },
  policy_caps: {
    max_rpe: 9,
    max_allowed_stress_pct: 100,
    block_heavy_neural: false,
    max_cardio_zone: 5,
  },
  penalties: [],
  raw_metrics: {},
};

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows welcome state when no data available', async () => {
    apiCached.mockRejectedValue(new Error('no data'));
    const { loadLatestEvaluation } = require('../services/readinessService');
    loadLatestEvaluation.mockRejectedValue(new Error('no data'));

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('ATTUNEDD')).toBeTruthy();
    });
  });

  it('renders score and coaching headline from server', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      if (url === '/api/coaching/projections') return Promise.resolve({ projections: [], heavy_session_simulation: null });
      if (url === '/api/plans/current') return Promise.resolve({ week: [] });
      return Promise.reject(new Error('unknown'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('73')).toBeTruthy();
    });
    expect(getByText('OPTIMAL')).toBeTruthy();
    expect(getByText("You're fully recovered. Push hard today.")).toBeTruthy();
  });

  it('renders YOUR COACH label', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('YOUR COACH')).toBeTruthy();
    });
  });

  it('renders coaching insights when nudges present', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('COACH INSIGHTS')).toBeTruthy();
      expect(getByText('Chest volume is on track this week.')).toBeTruthy();
    });
  });

  it('renders positive notes', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('High recovery — you can afford to push today.')).toBeTruthy();
    });
  });

  it('shows AI-GENERATED PLAN for today plan', async () => {
    const planResponse = {
      week: [{
        today: true,
        day_number: 1,
        session_type: 'push',
        rest_day: false,
        workout_status: 'pending',
        rationale: 'Your chest needs volume this week.',
        blocks: [{ name: 'Main', exercises: [{ name: 'Bench Press', sets: 3, rep_range: '8-10' }] }],
      }],
    };

    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      if (url === '/api/plans/current') return Promise.resolve(planResponse);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('AI-GENERATED PLAN')).toBeTruthy();
      expect(getByText('PUSH')).toBeTruthy();
    });
  });

  it('renders coach attribution text', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('AI analysis based on your training history, recovery data, and goals')).toBeTruthy();
    });
  });

  it('renders score explanation text', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('READINESS SCORE')).toBeTruthy();
      expect(getByText('Score = 100 minus recovery penalties. Tap the score to learn more.')).toBeTruthy();
    });
  });
});
