import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PostWorkoutDebriefProps } from '../../navigation/types';
import { getMeta } from '../../services/metaStateService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const EFFORT_COLORS: Record<string, string> = {
  light: '#888888',
  moderate: '#2ECC71',
  solid: '#F1C40F',
  overdone: '#E74C3C',
};

const BAND_COLORS: Record<string, string> = {
  optimal: '#2ECC71',
  green: '#2ECC71',
  suboptimal: '#F1C40F',
  yellow: '#F1C40F',
  high_risk: '#E74C3C',
  red: '#E74C3C',
};

export default function PostWorkoutDebriefScreen({ route, navigation }: PostWorkoutDebriefProps) {
  const { debrief } = route.params;
  const insets = useSafeAreaInsets();
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);

  useEffect(() => {
    getMeta('debrief_seen_count').then((val) => {
      const count = parseInt(val ?? '0', 10);
      setIsFirstWorkout(count === 0);
    });
  }, []);

  const effortColor = EFFORT_COLORS[debrief.effort_rating] ?? '#888888';
  const bandAfterColor = BAND_COLORS[debrief.band_after] ?? '#888888';
  const deltaPrefix = debrief.adaptation_delta >= 0 ? '+' : '';
  const deltaColor = debrief.adaptation_delta > 0
    ? '#2ECC71'
    : debrief.adaptation_delta < 0
      ? '#E74C3C'
      : '#888888';

  const handleDone = () => {
    navigation.popToTop();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
      ]}>
      <Text style={styles.label}>Session complete</Text>

      <Text style={styles.summaryLine}>{debrief.summary_line}</Text>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>Before</Text>
          <Text style={styles.scoreValue}>{debrief.score_before}</Text>
        </View>
        <View style={styles.deltaBlock}>
          <Text style={[styles.deltaValue, { color: deltaColor }]}>
            {deltaPrefix}{debrief.adaptation_delta}
          </Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>After</Text>
          <Text style={[styles.scoreValue, { color: bandAfterColor }]}>
            {debrief.score_after}
          </Text>
        </View>
      </View>

      {debrief.band_dropped && (
        <View style={styles.bandDropBadge}>
          <Text style={styles.bandDropText}>Score dropped</Text>
        </View>
      )}

      {isFirstWorkout && (
        <Text style={styles.coachMessage}>
          Welcome to coached training. Your score will become more accurate as we learn your patterns over the next few sessions.
        </Text>
      )}

      <View style={styles.section}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Effort</Text>
          <Text style={[styles.metricValue, { color: effortColor }]}>
            {debrief.effort_rating.charAt(0).toUpperCase() + debrief.effort_rating.slice(1)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Intensity</Text>
          <Text style={styles.metricValue}>
            {Math.round(debrief.stress_utilization * 100)}%
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Sets</Text>
          <Text style={styles.metricValue}>{debrief.sets_logged}</Text>
        </View>
        {debrief.override_count != null && debrief.override_count > 0 && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabelOverride}>Rest overrides</Text>
            <Text style={styles.metricValueOverride}>{debrief.override_count}</Text>
          </View>
        )}
      </View>

      {debrief.key_observation && (
        <View style={styles.observationSection}>
          <Text style={styles.observationText}>{debrief.key_observation}</Text>
        </View>
      )}

      {debrief.muscles_trained.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Trained</Text>
          <View style={styles.muscleRow}>
            {debrief.muscles_trained.map((muscle) => (
              <Text key={muscle} style={styles.muscleChip}>
                {muscle.replace(/_/g, ' ')}
              </Text>
            ))}
          </View>
        </View>
      )}

      <Pressable onPress={handleDone} style={styles.doneButton}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  label: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 24,
  },
  summaryLine: {
    color: '#CCCCCC',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 24,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scoreValue: {
    color: '#EAEAEA',
    fontSize: 36,
    fontWeight: '200',
    fontFamily: MONO,
  },
  deltaBlock: {
    alignItems: 'center',
    paddingTop: 16,
  },
  deltaValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: MONO,
  },
  bandDropBadge: {
    borderWidth: 1,
    borderColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 24,
  },
  bandDropText: {
    color: '#E74C3C',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  section: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222222',
    paddingTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  metricLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  metricValue: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: MONO,
  },
  metricLabelOverride: {
    color: '#F1C40F',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  metricValueOverride: {
    color: '#F1C40F',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: MONO,
  },
  observationSection: {
    width: '100%',
    paddingVertical: 12,
    marginBottom: 8,
  },
  observationText: {
    color: '#999999',
    fontSize: 13,
    fontFamily: MONO,
    textAlign: 'center',
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#333333',
  },
  doneText: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: MONO,
  },
  coachMessage: {
    color: '#2ECC71',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
    fontStyle: 'italic',
  },
});
