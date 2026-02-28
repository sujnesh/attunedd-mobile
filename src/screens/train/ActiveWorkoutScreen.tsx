import React, { useCallback, useEffect, useState } from 'react';
import {
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
import {
  checkSetCaps,
  logSet,
  getWorkoutState,
  finishWorkout,
  type ExerciseSet,
  type WorkoutState,
} from '../../services/workoutService';
import type { ActiveWorkoutProps } from '../../navigation/types';
import type { EnforcementResult } from '../../engine/types';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function ActiveWorkoutScreen({ route, navigation }: ActiveWorkoutProps) {
  const { workoutId, mobileLocalId } = route.params;
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<WorkoutState | null>(null);
  const [input, setInput] = useState('');
  const [capWarning, setCapWarning] = useState<EnforcementResult | null>(null);
  const [pendingInput, setPendingInput] = useState('');
  const [fatigueExercises, setFatigueExercises] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  const refresh = useCallback(async () => {
    const ws = await getWorkoutState(workoutId);
    setState(ws);
  }, [workoutId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async () => {
    const parsed = parseSetInput(input.trim());
    if (!parsed) return;

    const currentStress = state?.actualStress ?? 0;
    const allowedStress = state?.allowedStress ?? 0;

    const capCheck = await checkSetCaps(
      parsed.exerciseName, parsed.rpe, currentStress, allowedStress
    );

    if (!capCheck.allowed) {
      setCapWarning(capCheck);
      setPendingInput(input.trim());
      return;
    }

    await submitSet(input.trim(), false);
  };

  const submitSet = async (rawInput: string, overrideCap: boolean) => {
    const parsed = parseSetInput(rawInput);
    if (!parsed) return;

    const result = await logSet(
      workoutId, mobileLocalId,
      parsed.exerciseName, parsed.weight, parsed.reps, parsed.rpe,
      overrideCap
    );

    if (result.fatigue) {
      setFatigueExercises(prev => new Set(prev).add(parsed.exerciseName));
    }

    setInput('');
    setCapWarning(null);
    setPendingInput('');
    Keyboard.dismiss();
    await refresh();
  };

  const handleOverride = async () => {
    if (pendingInput) {
      await submitSet(pendingInput, true);
    }
  };

  const handleDismissWarning = () => {
    setCapWarning(null);
    setPendingInput('');
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await finishWorkout(workoutId);
      navigation.popToTop();
    } catch {
      setFinishing(false);
    }
  };

  if (!state) return <View style={styles.root} />;

  const stressPct = state.allowedStress > 0
    ? Math.round((state.actualStress / state.allowedStress) * 100)
    : null;

  const exercises = groupByExercise(state.sets);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PLANNED SESSION</Text>
        <View style={styles.stressRow}>
          <Text style={styles.stressValue}>
            {Math.round(state.actualStress)}
            {state.allowedStress > 0 && (
              <Text style={styles.stressDenom}> / {Math.round(state.allowedStress)}</Text>
            )}
          </Text>
          {stressPct != null && (
            <Text style={[styles.stressPct, stressPct >= 85 && styles.stressWarn]}>
              {stressPct}%
            </Text>
          )}
        </View>
        <View style={styles.capsRow}>
          <Text style={styles.capChip}>RPE {state.caps.max_rpe}</Text>
          <Text style={styles.capChip}>{state.caps.max_allowed_stress_pct}%</Text>
          {state.caps.block_heavy_neural && (
            <Text style={[styles.capChip, styles.capAlert]}>NO HEAVY</Text>
          )}
        </View>
      </View>

      <ScrollView style={styles.setList} keyboardShouldPersistTaps="handled">
        {exercises.map(([name, sets]) => (
          <View key={name} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{name.toUpperCase()}</Text>
              {fatigueExercises.has(name) && (
                <Text style={styles.fatigueTag}>FATIGUE</Text>
              )}
            </View>
            {sets.map(s => (
              <View key={s.localId} style={styles.setRow}>
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

      {capWarning && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>
            {formatViolation(capWarning.violationType)}
          </Text>
          <View style={styles.warningActions}>
            <Pressable onPress={handleOverride} style={styles.warningBtn}>
              <Text style={styles.overrideText}>OVERRIDE</Text>
            </Pressable>
            <Pressable onPress={handleDismissWarning} style={styles.warningBtn}>
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

function groupByExercise(sets: ExerciseSet[]): [string, ExerciseSet[]][] {
  const map = new Map<string, ExerciseSet[]>();
  for (const s of sets) {
    const group = map.get(s.exerciseName) ?? [];
    group.push(s);
    map.set(s.exerciseName, group);
  }
  return Array.from(map.entries());
}

function formatViolation(type?: string): string {
  switch (type) {
    case 'heavy_neural_block': return 'Heavy neural exercise blocked by current recovery state';
    case 'rpe_cap': return 'RPE exceeds current cap';
    case 'stress_cap': return 'Stress exceeds allowed percentage';
    default: return 'Cap violation detected';
  }
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stressDenom: {
    color: '#555555',
    fontSize: 16,
  },
  stressPct: {
    color: '#888888',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  setList: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 24,
  },
  setText: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  setStress: {
    color: '#888888',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
