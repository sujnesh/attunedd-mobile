import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HealthScreen from '../screens/HealthScreen';

jest.mock('../services/healthService', () => ({
  getRecentActivities: jest.fn(),
}));

jest.mock('../services/metaStateService', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn(),
}));

jest.mock('../services/apiClient', () => ({
  apiCached: jest.fn(),
}));

const { getRecentActivities } = require('../services/healthService');
const { getMeta } = require('../services/metaStateService');
const { apiCached } = require('../services/apiClient');

describe('HealthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRecentActivities.mockResolvedValue([]);
    getMeta.mockResolvedValue(null);
    apiCached.mockRejectedValue(new Error('no whoop'));
  });

  it('renders HEALTH title', async () => {
    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText('HEALTH')).toBeTruthy();
    });
  });

  it('shows empty state when no data', async () => {
    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText('No health data yet')).toBeTruthy();
    });
  });

  it('shows WHOOP recovery data when available', async () => {
    apiCached.mockResolvedValue({
      cycles: [{
        date: '2026-03-01',
        recovery_score: 78,
        hrv_rmssd: 55.2,
        resting_hr: 52,
        strain: 12.4,
      }],
      sleep: [],
    });

    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText('78%')).toBeTruthy();
      expect(getByText('RECOVERY')).toBeTruthy();
    });
  });

  it('shows WHOOP sleep data when available', async () => {
    apiCached.mockResolvedValue({
      cycles: [],
      sleep: [{
        date: '2026-03-01',
        performance_percentage: 85,
        efficiency: 92,
        total_sleep_hours: 7.5,
      }],
    });

    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText('SLEEP')).toBeTruthy();
      expect(getByText('85%')).toBeTruthy();
    });
  });

  it('shows activities when present', async () => {
    getRecentActivities.mockResolvedValue([
      {
        localId: 1,
        source: 'apple_health',
        startTime: Date.now() - 3600000,
        durationMinutes: 45,
        derivedZone: 3,
        computedAsu: 12.5,
        syncedFlag: true,
      },
    ]);

    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText('ACTIVITIES')).toBeTruthy();
      expect(getByText('APPLE_HEALTH')).toBeTruthy();
      expect(getByText('45m')).toBeTruthy();
    });
  });

  it('renders empty state help text', async () => {
    const { getByText } = render(<HealthScreen />);
    await waitFor(() => {
      expect(getByText(/Connect WHOOP/)).toBeTruthy();
    });
  });
});
