import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, apiCached } from '../services/apiClient';
import { setMeta } from '../services/metaStateService';
import { logout } from '../navigation/AppNavigator';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Demographics {
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
}

interface CurrentLifts {
  bench?: number | null;
  squat?: number | null;
  deadlift?: number | null;
  unit?: 'kg' | 'lb';
}

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
    training_history?: string | null;
    current_lifts?: CurrentLifts | null;
  } | null;
  demographics?: Demographics | null;
  plan: {
    id: number;
    name: string;
    training_type: string;
  } | null;
}

const PREF_OPTIONS: Record<string, { label: string; values: { value: string; label: string }[] }> = {
  training_type: {
    label: 'TYPE',
    values: [
      { value: 'bodybuilding', label: 'BODYBUILDING' },
      { value: 'running', label: 'RUNNING' },
      { value: 'hybrid', label: 'HYBRID' },
    ],
  },
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

const GENDER_OPTIONS = [
  { value: 'male', label: 'MALE' },
  { value: 'female', label: 'FEMALE' },
  { value: 'other', label: 'OTHER' },
  { value: 'prefer_not_to_say', label: 'SKIP' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [whoopBusy, setWhoopBusy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Demographics editing state
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editHeightCm, setEditHeightCm] = useState('');
  const [editWeightKg, setEditWeightKg] = useState('');

  // Lifts editing state
  const [editBench, setEditBench] = useState('');
  const [editSquat, setEditSquat] = useState('');
  const [editDeadlift, setEditDeadlift] = useState('');
  const [editLiftUnit, setEditLiftUnit] = useState<'kg' | 'lb'>('kg');

  // Training history editing state
  const [editHistory, setEditHistory] = useState('');

  const populateEditState = useCallback((p: ProfileData) => {
    const d = p.demographics;
    setEditAge(d?.age != null ? String(d.age) : '');
    setEditGender(d?.gender ?? '');
    setEditHeightCm(d?.height_cm != null ? String(d.height_cm) : '');
    setEditWeightKg(d?.weight_kg != null ? String(d.weight_kg) : '');

    const lifts = p.preferences?.current_lifts;
    setEditBench(lifts?.bench != null ? String(lifts.bench) : '');
    setEditSquat(lifts?.squat != null ? String(lifts.squat) : '');
    setEditDeadlift(lifts?.deadlift != null ? String(lifts.deadlift) : '');
    setEditLiftUnit(lifts?.unit ?? 'kg');

    setEditHistory(p.preferences?.training_history ?? '');
  }, []);

  const fetchProfile = useCallback(() => {
    apiCached<ProfileData>('/api/profile', 'cache_profile')
      .then((p) => {
        setProfile(p);
        populateEditState(p);
      })
      .catch(() => {});
  }, [populateEditState]);

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

  interface SaveOverrides {
    prefKey?: string;
    prefValue?: string;
    gender?: string;
    age?: string;
    heightCm?: string;
    weightKg?: string;
    history?: string;
    bench?: string;
    squat?: string;
    deadlift?: string;
    liftUnit?: 'kg' | 'lb';
  }

  const saveAll = async (overrides?: SaveOverrides) => {
    if (!profile?.preferences || saving) return;
    setSaving(true);
    setEditingKey(null);

    const prefs = profile.preferences;
    const numericKeys = ['days_per_week', 'session_minutes'];
    const prefPayload: Record<string, unknown> = { ...prefs };

    if (overrides?.prefKey) {
      const v = overrides.prefValue!;
      prefPayload[overrides.prefKey] = numericKeys.includes(overrides.prefKey)
        ? parseInt(v, 10) : v;
    }

    // Use overrides if provided, otherwise fall back to current state
    const benchVal = overrides?.bench ?? editBench;
    const squatVal = overrides?.squat ?? editSquat;
    const deadliftVal = overrides?.deadlift ?? editDeadlift;
    const liftUnitVal = overrides?.liftUnit ?? editLiftUnit;
    const b = parseFloat(benchVal);
    const s = parseFloat(squatVal);
    const d = parseFloat(deadliftVal);
    if (b || s || d) {
      prefPayload.current_lifts = {
        bench: b || undefined,
        squat: s || undefined,
        deadlift: d || undefined,
        unit: liftUnitVal,
      };
    }

    const historyVal = overrides?.history ?? editHistory;
    prefPayload.training_history = historyVal || undefined;

    const demographics: Record<string, unknown> = {};
    const ageVal = overrides?.age ?? editAge;
    const ageNum = parseInt(ageVal, 10);
    if (!isNaN(ageNum) && ageNum > 0) demographics.age = ageNum;
    const genderVal = overrides?.gender ?? editGender;
    if (genderVal) demographics.gender = genderVal;
    const heightVal = overrides?.heightCm ?? editHeightCm;
    const hNum = parseInt(heightVal, 10);
    if (!isNaN(hNum) && hNum > 0) demographics.height_cm = hNum;
    const weightVal = overrides?.weightKg ?? editWeightKg;
    const wNum = parseFloat(weightVal);
    if (!isNaN(wNum) && wNum > 0) demographics.weight_kg = wNum;

    try {
      await api('/api/onboarding/preferences', {
        method: 'POST',
        body: { preferences: prefPayload, demographics },
      });

      // Bust all caches so dashboard/train screens pick up changes
      await Promise.all([
        setMeta('cache_profile', ''),
        setMeta('cache_plans_current', ''),
        setMeta('cache_coaching_today', ''),
      ]).catch(() => {});

      // Fetch fresh profile (bypasses cache)
      const fresh = await api<ProfileData>('/api/profile');
      // Also update the cache with fresh data
      await setMeta('cache_profile', JSON.stringify(fresh)).catch(() => {});
      setProfile(fresh);
      populateEditState(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update settings';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePrefSelect = (key: string, value: string) => {
    saveAll({ prefKey: key, prefValue: value });
  };

  const prefs = profile?.preferences;
  const demo = profile?.demographics;
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

      {/* Demographics — editable */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ABOUT YOU</Text>
        <Text style={styles.editHint}>Tap a value to edit</Text>

        <Pressable
          onPress={() => setEditingKey(editingKey === 'age' ? null : 'age')}
          style={styles.row}>
          <Text style={styles.label}>AGE</Text>
          <Text style={[styles.value, styles.editable]}>
            {editAge || '\u2014'}
          </Text>
        </Pressable>
        {editingKey === 'age' && (
          <View style={styles.inlineEdit}>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={editAge}
              onChangeText={setEditAge}
              maxLength={3}
              autoFocus
            />
            <Pressable style={styles.saveBtn} onPress={() => saveAll({ age: editAge })}>
              <Text style={styles.saveBtnText}>{saving ? '...' : 'SAVE'}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => setEditingKey(editingKey === 'gender' ? null : 'gender')}
          style={styles.row}>
          <Text style={styles.label}>GENDER</Text>
          <Text style={[styles.value, styles.editable]}>
            {editGender ? formatValue(editGender) : '\u2014'}
          </Text>
        </Pressable>
        {editingKey === 'gender' && (
          <View style={styles.optionsRow}>
            {GENDER_OPTIONS.map((opt) => {
              const isSelected = opt.value === editGender;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setEditGender(opt.value); saveAll({ gender: opt.value }); }}
                  style={[styles.optionChip, isSelected && styles.optionChipSelected]}>
                  <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => setEditingKey(editingKey === 'height' ? null : 'height')}
          style={styles.row}>
          <Text style={styles.label}>HEIGHT</Text>
          <Text style={[styles.value, styles.editable]}>
            {editHeightCm ? `${editHeightCm} cm` : '\u2014'}
          </Text>
        </Pressable>
        {editingKey === 'height' && (
          <View style={styles.inlineEdit}>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              placeholder="cm"
              placeholderTextColor="#444444"
              value={editHeightCm}
              onChangeText={setEditHeightCm}
              maxLength={3}
              autoFocus
            />
            <Pressable style={styles.saveBtn} onPress={() => saveAll({ heightCm: editHeightCm })}>
              <Text style={styles.saveBtnText}>{saving ? '...' : 'SAVE'}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => setEditingKey(editingKey === 'weight' ? null : 'weight')}
          style={styles.row}>
          <Text style={styles.label}>WEIGHT</Text>
          <Text style={[styles.value, styles.editable]}>
            {editWeightKg ? `${editWeightKg} kg` : '\u2014'}
          </Text>
        </Pressable>
        {editingKey === 'weight' && (
          <View style={styles.inlineEdit}>
            <TextInput
              style={styles.inlineInput}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor="#444444"
              value={editWeightKg}
              onChangeText={setEditWeightKg}
              maxLength={5}
              autoFocus
            />
            <Pressable style={styles.saveBtn} onPress={() => saveAll({ weightKg: editWeightKg })}>
              <Text style={styles.saveBtnText}>{saving ? '...' : 'SAVE'}</Text>
            </Pressable>
          </View>
        )}
      </View>

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

      {/* Current Lifts — editable */}
      {prefs && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CURRENT LIFTS</Text>
          <Text style={styles.editHint}>Approximate 1RM or recent heavy set</Text>

          <View style={styles.unitToggle}>
            <Pressable
              onPress={() => setEditLiftUnit('kg')}
              style={[styles.unitBtn, editLiftUnit === 'kg' && styles.unitBtnActive]}>
              <Text style={[styles.unitText, editLiftUnit === 'kg' && styles.unitTextActive]}>KG</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditLiftUnit('lb')}
              style={[styles.unitBtn, editLiftUnit === 'lb' && styles.unitBtnActive]}>
              <Text style={[styles.unitText, editLiftUnit === 'lb' && styles.unitTextActive]}>LB</Text>
            </Pressable>
          </View>

          <View style={styles.liftRow}>
            <Text style={styles.label}>BENCH</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={editBench}
              onChangeText={setEditBench}
            />
          </View>
          <View style={styles.liftRow}>
            <Text style={styles.label}>SQUAT</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={editSquat}
              onChangeText={setEditSquat}
            />
          </View>
          <View style={styles.liftRow}>
            <Text style={styles.label}>DEADLIFT</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={editDeadlift}
              onChangeText={setEditDeadlift}
            />
          </View>

          <Pressable
            style={[styles.saveLiftBtn, saving && { opacity: 0.5 }]}
            onPress={() => saveAll({ bench: editBench, squat: editSquat, deadlift: editDeadlift, liftUnit: editLiftUnit })}
            disabled={saving}>
            <Text style={styles.saveLiftBtnText}>{saving ? 'SAVING...' : 'SAVE LIFTS'}</Text>
          </Pressable>
        </View>
      )}

      {/* Training History — editable */}
      {prefs && (
        <View style={styles.section}>
          <Pressable
            onPress={() => setEditingKey(editingKey === 'history' ? null : 'history')}>
            <Text style={styles.sectionHeader}>
              TRAINING HISTORY {editingKey === 'history' ? '\u25B2' : '\u25BC'}
            </Text>
          </Pressable>
          {editingKey === 'history' && (
            <>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                maxLength={500}
                placeholder="e.g., push/pull/legs, bench 80kg, squat 100kg, run 5k twice a week"
                placeholderTextColor="#444444"
                value={editHistory}
                onChangeText={setEditHistory}
                textAlignVertical="top"
              />
              <Pressable
                style={[styles.saveLiftBtn, saving && { opacity: 0.5 }]}
                onPress={() => saveAll({ history: editHistory })}
                disabled={saving}>
                <Text style={styles.saveLiftBtnText}>{saving ? 'SAVING...' : 'SAVE'}</Text>
              </Pressable>
            </>
          )}
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
    alignItems: 'center',
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
  inlineEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 16,
    fontFamily: MONO,
    width: 80,
    textAlign: 'center',
    paddingVertical: 8,
  },
  saveBtn: {
    borderWidth: 0.5,
    borderColor: '#2ECC71',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: '#2ECC71',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
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
  // Lifts
  unitToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  unitBtn: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unitBtnActive: {
    borderColor: '#2ECC71',
    backgroundColor: '#0D1A0D',
  },
  unitText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  unitTextActive: {
    color: '#2ECC71',
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A1A',
  },
  liftInput: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
    width: 72,
    textAlign: 'center',
    paddingVertical: 6,
  },
  saveLiftBtn: {
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: '#2ECC71',
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveLiftBtnText: {
    color: '#2ECC71',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  // Training history
  textArea: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    minHeight: 80,
    fontFamily: MONO,
    marginTop: 8,
  },
  // Integrations
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
