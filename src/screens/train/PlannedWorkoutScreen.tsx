import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseSetInput } from '../../services/setParser';
import { useActiveWorkout } from '../../workout/controller/useActiveWorkout';
import type { Deviation } from '../../workout/core/deviationEngine';
import type { SessionSet } from '../../workout/core/sessionState';
import type { PlannedWorkoutProps } from '../../navigation/types';
import type { PlanBlock, CurrentPlanResponse } from '../../types/api';
import { apiCached } from '../../services/apiClient';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function PlannedWorkoutScreen({ route, navigation }: PlannedWorkoutProps) {
  const { draftId } = route.params;
  const insets = useSafeAreaInsets();
  const {
    session,
    nudge,
    fatigueExercises,
    loading,
    finishing,
    initSession,
    submitSet,
    confirmOverride,
    finishSession,
  } = useActiveWorkout();

  const [input, setInput] = useState('');
  const [deviation, setDeviation] = useState<Deviation | null>(null);
  const [pendingParsed, setPendingParsed] = useState<{
    exerciseName: string;
    weight: number | null;
    reps: number;
    rpe: number;
  } | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [showPlan, setShowPlan] = useState(true);

  useEffect(() => {
    initSession('planned', draftId);
    fetchTodayBlocks(setPlanBlocks);
  }, [draftId, initSession]);

  const handleSubmit = async () => {
    const parsed = parseSetInput(input.trim());
    if (!parsed) return;

    const dev = await submitSet(parsed.exerciseName, parsed.weight, parsed.reps, parsed.rpe);
    if (dev) {
      setDeviation(dev);
      setPendingParsed(parsed);
      return;
    }

    setInput('');
    setDeviation(null);
    setPendingParsed(null);
    Keyboard.dismiss();
  };

  const handleOverride = async () => {
    if (!pendingParsed || !deviation) return;
    await confirmOverride(
      pendingParsed.exerciseName,
      pendingParsed.weight,
      pendingParsed.reps,
      pendingParsed.rpe,
      deviation,
    );
    setInput('');
    setDeviation(null);
    setPendingParsed(null);
    Keyboard.dismiss();
  };

  const handleDismiss = () => {
    setDeviation(null);
    setPendingParsed(null);
  };

  const handleFinish = () => {
    const setCount = session?.sets.length ?? 0;
    Alert.alert(
      'Finish Session?',
      `${setCount} set${setCount !== 1 ? 's' : ''} logged`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ],
    );
  };

  const doFinish = async () => {
    try {
      const debrief = await finishSession();
      if (debrief) {
        navigation.replace('PostWorkoutDebrief', { debrief });
      } else {
        navigation.popToTop();
      }
    } catch {
      Alert.alert('Sync Failed', 'Could not reach server. Please retry.', [
        { text: 'OK' },
      ]);
    }
  };

  if (loading || !session) return <View style={styles.root} />;

  const stressPct = session.allowedStress > 0
    ? Math.round((session.cumulativeStress / session.allowedStress) * 100)
    : null;

  const exercises = groupByExercise(session.sets);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PLANNED SESSION</Text>
        <View style={styles.stressRow}>
          <Text style={styles.stressValue}>
            {Math.round(session.cumulativeStress)}
            {session.allowedStress > 0 && (
              <Text style={styles.stressDenom}> / {Math.round(session.allowedStress)}</Text>
            )}
          </Text>
          {stressPct != null && (
            <Text style={[styles.stressPct, stressPct >= 85 && styles.stressWarn]}>
              {stressPct}%
            </Text>
          )}
        </View>
        <View style={styles.capsRow}>
          <Text style={styles.capChip}>RPE {session.caps.max_rpe}</Text>
          <Text style={styles.capChip}>{session.caps.max_allowed_stress_pct}%</Text>
          {session.caps.block_heavy_neural && (
            <Text style={[styles.capChip, styles.capAlert]}>NO HEAVY</Text>
          )}
        </View>
      </View>

      {nudge && (
        <View style={styles.nudgeBar}>
          <Text style={styles.nudgeText}>{nudge}</Text>
        </View>
      )}

      <ScrollView style={styles.setList} keyboardShouldPersistTaps="handled">
        {planBlocks.length > 0 && (
          <View style={styles.prescribedSection}>
            <Pressable onPress={() => setShowPlan(!showPlan)} style={styles.prescribedHeader}>
              <Text style={styles.prescribedLabel}>PRESCRIBED</Text>
              <Text style={styles.prescribedToggle}>{showPlan ? 'HIDE' : 'SHOW'}</Text>
            </Pressable>
            {showPlan && planBlocks
              .filter((b) => b.name === 'Main')
              .flatMap((b) => b.exercises)
              .map((ex, i) => (
                <View key={i} style={styles.prescribedRow}>
                  <Text style={styles.prescribedName}>{ex.name}</Text>
                  <Text style={styles.prescribedDetail}>
                    {ex.sets && ex.rep_range
                      ? `${ex.sets}×${ex.rep_range} @RPE ${ex.rpe_target ?? '—'}`
                      : ex.duration_minutes
                        ? `${ex.duration_minutes} min${ex.zone ? ` ${ex.zone}` : ''}`
                        : ''}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {exercises.length > 0 && (
          <Text style={styles.loggedLabel}>LOGGED</Text>
        )}
        {exercises.map(([name, sets]) => (
          <View key={name} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{name.toUpperCase()}</Text>
              {fatigueExercises.has(name) && (
                <Text style={styles.fatigueTag}>FATIGUE</Text>
              )}
            </View>
            {sets.map((s, i) => (
              <View key={i} style={styles.setRow}>
                <Text style={styles.setNum}>#{s.setNumber}</Text>
                <Text style={styles.setText}>
                  {s.weight != null ? `${s.weight}x` : ''}{s.reps}@{s.rpe}
                </Text>
                <Text style={styles.setStress}>{Math.round(s.stressUnits)}</Text>
                {s.capOverride && <Text style={styles.overrideTag}>OVR</Text>}
              </View>
            ))}
          </View>
        ))}
        {exercises.length === 0 && (
          <Text style={styles.emptyHint}>Log sets below{'\n'}e.g. bench press 135x5@8</Text>
        )}
      </ScrollView>

      {deviation && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>{deviation.message}</Text>
          <View style={styles.warningActions}>
            <Pressable onPress={handleOverride} style={styles.warningBtn}>
              <Text style={styles.overrideText}>OVERRIDE</Text>
            </Pressable>
            <Pressable onPress={handleDismiss} style={styles.warningBtn}>
              <Text style={styles.dismissText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="bench press 135x5@8"
          placeholderTextColor="#444444"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
        <Pressable onPress={handleSubmit} style={styles.sendBtn}>
          <Text style={styles.sendText}>LOG</Text>
        </Pressable>
        <Pressable
          onPress={handleFinish}
          style={styles.finishBtn}
          disabled={finishing}>
          <Text style={styles.finishText}>
            {finishing ? '...' : 'DONE'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

async function fetchTodayBlocks(setBlocks: (b: PlanBlock[]) => void) {
  try {
    const body = await apiCached<CurrentPlanResponse>('/api/plans/current', 'cache_plans_current');
    const today = body.week?.find((d) => d.today);
    if (today?.blocks) {
      setBlocks(today.blocks);
    }
  } catch {
    // Non-fatal
  }
}

function groupByExercise(sets: SessionSet[]): [string, SessionSet[]][] {
  const map = new Map<string, SessionSet[]>();
  for (const s of sets) {
    const group = map.get(s.exerciseName) ?? [];
    group.push(s);
    map.set(s.exerciseName, group);
  }
  return Array.from(map.entries());
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  stressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stressValue: {
    color: '#EAEAEA',
    fontSize: 28,
    fontWeight: '200',
    fontFamily: MONO,
  },
  stressDenom: {
    color: '#555555',
    fontSize: 16,
  },
  stressPct: {
    color: '#888888',
    fontSize: 14,
    fontFamily: MONO,
  },
  stressWarn: {
    color: '#F1C40F',
  },
  capsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  capChip: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capAlert: {
    color: '#E74C3C',
    borderColor: '#E74C3C',
  },
  nudgeBar: {
    backgroundColor: '#0D0D1A',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333366',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  nudgeText: {
    color: '#8888CC',
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
  },
  setList: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  prescribedSection: {
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#1A3A1A',
    padding: 12,
  },
  prescribedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  prescribedLabel: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  prescribedToggle: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  prescribedRow: {
    paddingVertical: 4,
  },
  prescribedName: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: MONO,
  },
  prescribedDetail: {
    color: '#555555',
    fontSize: 10,
    fontFamily: MONO,
    marginTop: 1,
  },
  loggedLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  exerciseBlock: {
    marginBottom: 20,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseName: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  fatigueTag: {
    color: '#E74C3C',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    borderWidth: 0.5,
    borderColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  setNum: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    width: 24,
  },
  setText: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
    flex: 1,
  },
  setStress: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    width: 48,
    textAlign: 'right',
  },
  overrideTag: {
    color: '#F1C40F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyHint: {
    color: '#333333',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 80,
    lineHeight: 22,
    fontFamily: MONO,
  },
  warningBar: {
    backgroundColor: '#1A1000',
    borderTopWidth: 0.5,
    borderTopColor: '#F1C40F',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  warningText: {
    color: '#F1C40F',
    fontSize: 12,
    marginBottom: 8,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 16,
  },
  warningBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  overrideText: {
    color: '#E74C3C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dismissText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    backgroundColor: '#0D0D0D',
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#151515',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendText: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  finishBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  finishText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
