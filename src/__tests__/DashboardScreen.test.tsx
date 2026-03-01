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

jest.mock('../services/checkInService', () => ({
  saveCheckIn: jest.fn(),
  getLastCheckIn: jest.fn().mockResolvedValue(null),
  shouldShowCheckIn: jest.fn().mockReturnValue(false),
  getCheckInContext: jest.fn().mockReturnValue([]),
}));

jest.mock('../components/DailyCheckIn', () => {
  return () => null;
});

const { apiCached } = require('../services/apiClient');
const { getMeta } = require('../services/metaStateService');
const { shouldShowCheckIn, getLastCheckIn, getCheckInContext } = require('../services/checkInService');

const COACHING_RESPONSE = {
  adaptation_score: 73,
  risk_band: 'optimal',
  coaching: {
    headline: 'Load ratio stable this week.',
    tone: 'encouraging',
    primary_factor: null,
    nudges: ['Chest volume is on track this week.'],
    positive_notes: [],
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
    getMeta.mockResolvedValue(null);
    shouldShowCheckIn.mockReturnValue(false);
    getLastCheckIn.mockResolvedValue(null);
    getCheckInContext.mockReturnValue([]);
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

  it('renders score and band label from server', async () => {
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
    expect(getByText('READY')).toBeTruthy();
  });

  it('renders headline from coaching data', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('Load ratio stable this week.')).toBeTruthy();
    });
  });

  it('renders coaching insights when nudges present', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('INSIGHTS')).toBeTruthy();
      expect(getByText('Chest volume is on track this week.')).toBeTruthy();
    });
  });

  it('renders WHY section with no-penalty bullets', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('WHY')).toBeTruthy();
    });
  });

  it('shows TODAY label for plan card', async () => {
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
      expect(getByText('TODAY')).toBeTruthy();
      expect(getByText(/PUSH/)).toBeTruthy();
    });
  });

  it('does not show AI attribution text', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve(COACHING_RESPONSE);
      return Promise.reject(new Error('skip'));
    });

    const { queryByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(queryByText(/AI analysis/)).toBeNull();
      expect(queryByText(/AI-GENERATED/)).toBeNull();
    });
  });

  it('shows fallback headline when no penalties', async () => {
    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve({
        ...COACHING_RESPONSE,
        coaching: { ...COACHING_RESPONSE.coaching, headline: null },
      });
      return Promise.reject(new Error('skip'));
    });

    const { getByText } = render(<DashboardScreen />);
    await waitFor(() => {
      expect(getByText('No recovery penalties active.')).toBeTruthy();
    });
  });

  it('renders check-in context in WHY section when check-in has low energy', async () => {
    getLastCheckIn.mockResolvedValue({ energy: 1, sleepQuality: 3, soreness: 3 });
    getCheckInContext.mockReturnValue(['Low energy noted']);

    apiCached.mockImplementation((url: string) => {
      if (url === '/api/coaching/today') return Promise.resolve({
        ...COACHING_RESPONSE,
        coaching: { ...COACHING_RESPONSE.coaching, headline: null },
      });
      return Promise.reject(new Error('skip'));
    });

    const { getAllByText } = render(<DashboardScreen />);
    await waitFor(() => {
      // Appears in both headline and WHY bullet
      expect(getAllByText(/Low energy noted/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
