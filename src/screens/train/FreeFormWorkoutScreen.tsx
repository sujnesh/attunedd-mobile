import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { parseSetInput, isParseError, formatSetDisplay, rpeToRir } from '../../services/setParser';
import { useActiveWorkout } from '../../workout/controller/useActiveWorkout';
import type { Deviation } from '../../workout/core/deviationEngine';
import type { SessionSet } from '../../workout/core/sessionState';
import type { FreeFormWorkoutProps } from '../../navigation/types';
import { useSessionTimer } from '../../workout/hooks/useSessionTimer';
import { generateSetFeedback } from '../../workout/core/coachingEngine';
import FeedbackToast from '../../components/FeedbackToast';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function FreeFormWorkoutScreen({ route, navigation }: FreeFormWorkoutProps) {
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
    undoLastSet,
    editSet,
    deleteSet,
    finishSession,
  } = useActiveWorkout();

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useSessionTimer(session?.startedAt ?? null);
  const [input, setInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [deviation, setDeviation] = useState<Deviation | null>(null);
  const [pendingParsed, setPendingParsed] = useState<{
    exerciseName: string;
    weight: number | null;
    reps: number;
    rpe: number;
  } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'info' | 'warning'>('info');

  useEffect(() => {
    initSession('free_form', draftId);
  }, [draftId, initSession]);

  // Auto-dismiss parse errors after 3s
  useEffect(() => {
    if (parseError) {
      const timer = setTimeout(() => setParseError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [parseError]);

  const handleSubmit = async () => {
    const result = parseSetInput(input.trim());
    if (isParseError(result)) {
      setParseError(result.error);
      return;
    }

    setParseError(null);
    const dev = await submitSet(result.exerciseName, result.weight, result.reps, result.rpe);
    if (dev) {
      setDeviation(dev);
      setPendingParsed(result);
      return;
    }

    setInput('');
    setDeviation(null);
    setPendingParsed(null);

    // Show coaching feedback
    if (session) {
      const feedback = generateSetFeedback(session, {
        exerciseName: result.exerciseName,
        weight: result.weight,
        reps: result.reps,
        rpe: result.rpe,
      });
      if (feedback) {
        setFeedbackMessage(feedback.message);
        setFeedbackType(feedback.type);
      }
    }
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
  };

  const handleDismiss = () => {
    setDeviation(null);
    setPendingParsed(null);
  };

  const handleSetTap = (globalIndex: number, set: SessionSet) => {
    const rir = rpeToRir(set.rpe);
    const weightPart = set.weight != null ? `${set.weight}x` : '';
    setEditInput(`${set.exerciseName} ${weightPart}${set.reps} r${rir}`);
    setEditingIndex(globalIndex);
  };

  const handleEditSave = async () => {
    if (editingIndex == null) return;
    const result = parseSetInput(editInput.trim());
    if (isParseError(result)) {
      setParseError(result.error);
      return;
    }
    setParseError(null);
    await editSet(editingIndex, result.exerciseName, result.weight, result.reps, result.rpe);
    setEditingIndex(null);
    setEditInput('');
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditInput('');
  };

  const handleSetLongPress = (globalIndex: number) => {
    Alert.alert(
      'Delete this set?',
      'This will remove the set and recalculate stress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSet(globalIndex) },
      ],
    );
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

  const rirCap = rpeToRir(session.caps.max_rpe);
  const exercises = groupByExercise(session.sets);

  // Build global index map for tap-to-edit
  let globalIdx = 0;
  const exercisesWithGlobalIdx = exercises.map(([name, sets]) => {
    const withIdx = sets.map((s) => ({ ...s, globalIndex: globalIdx++ }));
    return [name, withIdx] as [string, (SessionSet & { globalIndex: number })[]];
  });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>FREE FORM</Text>
          <Text style={styles.timerText}>{timer}</Text>
        </View>
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
          <Text style={styles.capChip}>RIR {rirCap}</Text>
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

      <ScrollView
        ref={scrollRef}
        style={styles.setList}
        keyboardShouldPersistTaps="handled">
        {exercisesWithGlobalIdx.map(([name, sets]) => (
          <View key={name} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{name.toUpperCase()}</Text>
              {fatigueExercises.has(name) && (
                <Text style={styles.fatigueTag}>FATIGUE</Text>
              )}
            </View>
            {sets.map((s) => (
              <Pressable
                key={s.globalIndex}
                onPress={() => handleSetTap(s.globalIndex, s)}
                onLongPress={() => handleSetLongPress(s.globalIndex)}
                style={styles.setRow}>
                <Text style={styles.setNum}>#{s.setNumber}</Text>
                <Text style={styles.setText}>
                  {formatSetDisplay(s.weight, s.reps, s.rpe)}
                </Text>
                <Text style={styles.setStress}>{Math.round(s.stressUnits)}</Text>
                {s.capOverride && <Text style={styles.overrideTag}>OVR</Text>}
              </Pressable>
            ))}
          </View>
        ))}
        {exercises.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyHint}>bench press 80x8 r2</Text>
            <Text style={styles.emptySubtext}>r2 = could do 2 more reps</Text>
          </View>
        )}

        {/* FINISH WORKOUT button at bottom of scroll content */}
        {session.sets.length > 0 && (
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [
              styles.finishWorkoutBtn,
              pressed && styles.finishWorkoutBtnPressed,
            ]}
            disabled={finishing}>
            <Text style={styles.finishWorkoutText}>
              {finishing ? 'FINISHING...' : 'FINISH WORKOUT'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Edit modal inline */}
      {editingIndex != null && (
        <View style={styles.editBar}>
          <Text style={styles.editLabel}>EDIT SET</Text>
          <TextInput
            style={styles.editInput}
            value={editInput}
            onChangeText={setEditInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleEditSave}
          />
          <View style={styles.editActions}>
            <Pressable onPress={handleEditSave} style={styles.editBtn}>
              <Text style={styles.editSaveText}>SAVE</Text>
            </Pressable>
            <Pressable onPress={handleEditCancel} style={styles.editBtn}>
              <Text style={styles.editCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}

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

      <FeedbackToast
        message={feedbackMessage}
        type={feedbackType}
        onDismiss={() => setFeedbackMessage(null)}
      />

      {/* Parse error display */}
      {parseError && (
        <View style={styles.parseErrorBar}>
          <Text style={styles.parseErrorText}>{parseError}</Text>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            if (parseError) setParseError(null);
          }}
          placeholder="bench press 80x8 r2"
          placeholderTextColor="#444444"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
        {session.sets.length > 0 && (
          <Pressable onPress={undoLastSet} style={styles.undoBtn}>
            <Text style={styles.undoText}>UNDO</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSubmit} style={styles.sendBtn}>
          <Text style={styles.sendText}>LOG</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
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
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
  },
  timerText: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
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
    paddingVertical: 6,
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
  emptyContainer: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyHint: {
    color: '#444444',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: MONO,
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#333333',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: MONO,
  },
  finishWorkoutBtn: {
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  finishWorkoutBtnPressed: {
    backgroundColor: '#1A1A1A',
  },
  finishWorkoutText: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
  },
  editBar: {
    backgroundColor: '#111122',
    borderTopWidth: 0.5,
    borderTopColor: '#333366',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editLabel: {
    color: '#8888CC',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 6,
  },
  editInput: {
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#151515',
    borderWidth: 0.5,
    borderColor: '#333366',
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editSaveText: {
    color: '#2ECC71',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  editCancelText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
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
  parseErrorBar: {
    backgroundColor: '#1A0D0D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E74C3C',
  },
  parseErrorText: {
    color: '#E74C3C',
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
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
  undoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  undoText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
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
});
