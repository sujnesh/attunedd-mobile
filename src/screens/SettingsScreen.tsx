import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, apiCached } from '../services/apiClient';
import { logout } from '../navigation/AppNavigator';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface ProfileData {
  user: { id: number; email: string };
  whoop_connected: boolean;
  preferences: {
    training_type: string;
    primary_goal: string;
    experience_level: string;
    days_per_week: number;
    equipment: string;
    session_minutes: number;
  } | null;
  plan: {
    id: number;
    name: string;
    training_type: string;
  } | null;
}

const PREF_OPTIONS: Record<string, { label: string; values: { value: string; label: string }[] }> = {
  primary_goal: {
    label: 'GOAL',
    values: [
      { value: 'hypertrophy', label: 'HYPERTROPHY' },
      { value: 'strength', label: 'STRENGTH' },
      { value: 'fat_loss', label: 'FAT LOSS' },
      { value: 'endurance', label: 'ENDURANCE' },
    ],
  },
  experience_level: {
    label: 'EXPERIENCE',
    values: [
      { value: 'beginner', label: 'BEGINNER' },
      { value: 'intermediate', label: 'INTERMEDIATE' },
      { value: 'advanced', label: 'ADVANCED' },
    ],
  },
  days_per_week: {
    label: 'DAYS / WEEK',
    values: [
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5', label: '5' },
      { value: '6', label: '6' },
    ],
  },
  equipment: {
    label: 'EQUIPMENT',
    values: [
      { value: 'gym', label: 'FULL GYM' },
      { value: 'home', label: 'HOME' },
      { value: 'minimal', label: 'MINIMAL' },
    ],
  },
  session_minutes: {
    label: 'SESSION',
    values: [
      { value: '30', label: '30 MIN' },
      { value: '45', label: '45 MIN' },
      { value: '60', label: '60 MIN' },
      { value: '90', label: '90 MIN' },
    ],
  },
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [whoopBusy, setWhoopBusy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(() => {
    apiCached<ProfileData>('/api/profile', 'cache_profile')
      .then(setProfile)
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const handleConnectWhoop = async () => {
    if (whoopBusy) return;
    setWhoopBusy(true);
    try {
      const data = await api<{ authorize_url: string }>('/api/whoop/authorize');
      await Linking.openURL(data.authorize_url);
    } catch {
      Alert.alert('Error', 'Failed to start WHOOP connection');
    } finally {
      setWhoopBusy(false);
    }
  };

  const handleSyncWhoop = async () => {
    if (whoopBusy) return;
    setWhoopBusy(true);
    try {
      await api('/api/whoop/sync', { method: 'POST' });
      Alert.alert('Sync Started', 'WHOOP data is syncing in the background');
    } catch {
      Alert.alert('Error', 'Failed to start sync');
    } finally {
      setWhoopBusy(false);
    }
  };

  const handleDisconnectWhoop = () => {
    Alert.alert('Disconnect WHOOP', 'Are you sure you want to disconnect your WHOOP?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setWhoopBusy(true);
          try {
            await api('/api/whoop', { method: 'DELETE' });
            setProfile((prev) => prev ? { ...prev, whoop_connected: false } : prev);
          } catch {
            Alert.alert('Error', 'Failed to disconnect WHOOP');
          } finally {
            setWhoopBusy(false);
          }
        },
      },
    ]);
  };

  const handlePrefSelect = async (key: string, value: string) => {
    if (!profile?.preferences || saving) return;
    setSaving(true);
    setEditingKey(null);

    const numericKeys = ['days_per_week', 'session_minutes'];
    const payload: Record<string, unknown> = {
      ...profile.preferences,
      [key]: numericKeys.includes(key) ? parseInt(value, 10) : value,
    };

    try {
      await api('/api/onboarding/preferences', {
        method: 'POST',
        body: { preferences: payload },
      });
      // Refresh profile to get updated data + potentially regenerated plan
      const fresh = await api<ProfileData>('/api/profile');
      setProfile(fresh);
    } catch {
      Alert.alert('Error', 'Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  const prefs = profile?.preferences;
  const whoopConnected = profile?.whoop_connected ?? false;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}>
      <Text style={styles.title}>SETTINGS</Text>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.row}>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.value}>{profile?.user.email ?? '\u2014'}</Text>
        </View>
      </View>

      {/* Plan */}
      {profile?.plan && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CURRENT PLAN</Text>
          <View style={styles.row}>
            <Text style={styles.label}>NAME</Text>
            <Text style={styles.value}>{profile.plan.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>TYPE</Text>
            <Text style={styles.value}>{profile.plan.training_type.toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Preferences — editable */}
      {prefs && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TRAINING PREFERENCES</Text>
          <Text style={styles.editHint}>Tap a value to change it</Text>

          {Object.entries(PREF_OPTIONS).map(([key, config]) => {
            const currentValue = String((prefs as Record<string, unknown>)[key] ?? '');
            const isEditing = editingKey === key;

            return (
              <View key={key}>
                <Pressable
                  onPress={() => setEditingKey(isEditing ? null : key)}
                  style={styles.row}>
                  <Text style={styles.label}>{config.label}</Text>
                  <Text style={[styles.value, styles.editable]}>
                    {formatValue(currentValue)}
                    {saving && editingKey === key ? ' ...' : ''}
                  </Text>
                </Pressable>

                {isEditing && (
                  <View style={styles.optionsRow}>
                    {config.values.map((opt) => {
                      const isSelected = opt.value === currentValue;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => handlePrefSelect(key, opt.value)}
                          style={[styles.optionChip, isSelected && styles.optionChipSelected]}>
                          <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* WHOOP */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>INTEGRATIONS</Text>
        <View style={styles.row}>
          <Text style={styles.label}>WHOOP</Text>
          {whoopConnected ? (
            <Text style={styles.valueConnected}>CONNECTED</Text>
          ) : (
            <Text style={styles.valueInactive}>NOT CONNECTED</Text>
          )}
        </View>
        {whoopConnected ? (
          <View style={styles.whoopActions}>
            <Pressable
              style={({ pressed }) => [styles.whoopBtn, pressed && styles.pressed]}
              onPress={handleSyncWhoop}
              disabled={whoopBusy}>
              <Text style={styles.whoopBtnText}>
                {whoopBusy ? 'SYNCING...' : 'SYNC NOW'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.whoopBtnDanger, pressed && styles.pressed]}
              onPress={handleDisconnectWhoop}
              disabled={whoopBusy}>
              <Text style={styles.whoopBtnDangerText}>DISCONNECT</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.whoopBtn, pressed && styles.pressed]}
            onPress={handleConnectWhoop}
            disabled={whoopBusy}>
            <Text style={styles.whoopBtnText}>
              {whoopBusy ? 'CONNECTING...' : 'CONNECT WHOOP'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        style={styles.logoutBtn}
        disabled={loggingOut}>
        <Text style={styles.logoutText}>
          {loggingOut ? 'LOGGING OUT...' : 'LOG OUT'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function formatValue(val: string): string {
  return val.replace(/_/g, ' ').toUpperCase();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 4,
  },
  editHint: {
    color: '#333333',
    fontSize: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  value: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  editable: {
    color: '#2ECC71',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipSelected: {
    borderColor: '#2ECC71',
    backgroundColor: '#0D1A0D',
  },
  optionChipText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: MONO,
  },
  optionChipTextSelected: {
    color: '#2ECC71',
  },
  valueConnected: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: MONO,
    letterSpacing: 1,
  },
  valueInactive: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
  },
  whoopActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  whoopBtn: {
    borderWidth: 0.5,
    borderColor: '#2ECC71',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: '#151515',
  },
  whoopBtnText: {
    color: '#2ECC71',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  whoopBtnDanger: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  whoopBtnDangerText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  logoutBtn: {
    marginTop: 32,
    borderWidth: 0.5,
    borderColor: '#E74C3C',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
  },
});
