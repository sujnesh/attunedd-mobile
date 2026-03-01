import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../screens/SettingsScreen';

jest.mock('../services/apiClient', () => ({
  api: jest.fn(),
  apiCached: jest.fn(),
}));

jest.mock('../navigation/AppNavigator', () => ({
  logout: jest.fn(),
}));

const { api, apiCached } = require('../services/apiClient');

const PROFILE = {
  user: { id: 1, email: 'test@example.com' },
  whoop_connected: false,
  preferences: {
    training_type: 'bodybuilding',
    primary_goal: 'hypertrophy',
    experience_level: 'intermediate',
    days_per_week: 4,
    equipment: 'gym',
    session_minutes: 60,
  },
  plan: {
    id: 1,
    name: 'Push/Pull/Legs',
    training_type: 'bodybuilding',
  },
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiCached.mockResolvedValue(PROFILE);
  });

  it('renders user email', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('test@example.com')).toBeTruthy();
    });
  });

  it('renders SETTINGS title', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('SETTINGS')).toBeTruthy();
    });
  });

  it('renders current plan', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('Push/Pull/Legs')).toBeTruthy();
    });
  });

  it('renders training preferences', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('TRAINING PREFERENCES')).toBeTruthy();
      expect(getByText('HYPERTROPHY')).toBeTruthy();
      expect(getByText('INTERMEDIATE')).toBeTruthy();
    });
  });

  it('renders WHOOP not connected state', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('NOT CONNECTED')).toBeTruthy();
    });
  });

  it('renders WHOOP connected state', async () => {
    apiCached.mockResolvedValue({ ...PROFILE, whoop_connected: true });
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('CONNECTED')).toBeTruthy();
    });
  });

  it('shows edit hint for preferences', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('Tap a value to change it')).toBeTruthy();
    });
  });

  it('renders LOG OUT button', async () => {
    const { getByText } = render(<SettingsScreen />);
    await waitFor(() => {
      expect(getByText('LOG OUT')).toBeTruthy();
    });
  });
});
