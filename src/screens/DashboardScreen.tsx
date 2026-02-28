import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadLatestEvaluation,
  triggerManualEvaluation,
  type ReadinessState,
} from '../services/readinessService';
import type { ParsedCaps } from '../services/metaStateService';
import {
  buildExplanation,
  type ExplanationOutput,
  type PenaltyRow,
  type LimitRow,
} from '../services/explanationEngine';

const BAND_COLORS: Record<string, string> = {
  green: '#2ECC71',
  yellow: '#F1C40F',
  red: '#E74C3C',
  optimal: '#2ECC71',
  suboptimal: '#F1C40F',
  high_risk: '#E74C3C',
};

const TONE_COLORS: Record<string, string> = {
  encouraging: '#2ECC71',
  cautionary: '#F1C40F',
  protective: '#E74C3C',
  neutral: '#888888',
};

const BAND_LABELS: Record<string, string> = {
  green: 'OPTIMAL',
  yellow: 'SUBOPTIMAL',
  red: 'HIGH RISK',
  optimal: 'OPTIMAL',
  suboptimal: 'SUBOPTIMAL',
  high_risk: 'HIGH RISK',
};

function formatTimestamp(ts: number | null): string {
  if (ts == null || ts <= 0) return '—';
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}  ${hours}:${minutes}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ReadinessState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLatestEvaluation()
        .then((s) => {
          setState(s);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const freshData = await triggerManualEvaluation();
      setState({ data: freshData, isStale: false });
    } catch {
      // refresh failure is non-fatal
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  if (!loaded) return <View style={styles.root} />;

  const data = state?.data ?? null;

  if (!data || data.score == null || !data.band || !data.caps) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.pending}>Evaluation pending...</Text>
      </View>
    );
  }

  const coaching = data.coaching;
  const accent = coaching?.tone
    ? (TONE_COLORS[coaching.tone] ?? BAND_COLORS[data.band] ?? '#888888')
    : (BAND_COLORS[data.band] ?? '#888888');
  const bandLabel = BAND_LABELS[data.band] ?? data.band.toUpperCase();

  const explanation = buildExplanation({
    score: data.score,
    band: data.band,
    penalties: data.penalties,
    rawMetrics: data.rawMetrics,
    caps: data.caps,
  });

  // Use server coaching headline when available, fall back to local explanation
  const headline = coaching?.headline ?? explanation.decisionLine;

  return (
    <ScrollView
      style={styles.scrollRoot}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={[styles.score, { color: accent }]}>{data.score}</Text>
      <Text style={[styles.bandLabel, { color: accent }]}>{bandLabel}</Text>
      <Text style={styles.decisionLine}>{headline}</Text>

      {coaching?.nudges && coaching.nudges.length > 0 ? (
        <NudgesSection nudges={coaching.nudges} />
      ) : null}

      {coaching?.positive_notes && coaching.positive_notes.length > 0 ? (
        <PositiveNotesSection notes={coaching.positive_notes} />
      ) : null}

      {explanation.hasServerData ? (
        <WhyTodaySection explanation={explanation} score={data.score} />
      ) : data.source === 'local' ? (
        <Text style={styles.syncHint}>Full analysis available after sync</Text>
      ) : null}

      <SessionLimitsSection limits={explanation.sessionLimits} />

      <Text style={styles.timestamp}>{formatTimestamp(data.timestamp)}</Text>

      <Pressable
        onPress={handleRefresh}
        style={styles.refreshButton}
        disabled={refreshing}>
        <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
          {refreshing ? 'REFRESHING' : 'REFRESH'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function NudgesSection({ nudges }: { nudges: string[] }) {
  return (
    <View style={styles.nudgesContainer}>
      {nudges.map((nudge, i) => (
        <Text key={i} style={styles.nudgeText}>{nudge}</Text>
      ))}
    </View>
  );
}

function PositiveNotesSection({ notes }: { notes: string[] }) {
  return (
    <View style={styles.positiveContainer}>
      {notes.map((note, i) => (
        <Text key={i} style={styles.positiveText}>{note}</Text>
      ))}
    </View>
  );
}

function WhyTodaySection({ explanation, score }: { explanation: ExplanationOutput; score: number }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>WHY TODAY</Text>
      {explanation.penaltyBreakdown.map((row, i) => (
        <PenaltyRowView key={i} row={row} />
      ))}
      <Text style={styles.totalLine}>
        (total: -{explanation.totalDeducted} from 100)
      </Text>
    </View>
  );
}

function PenaltyRowView({ row }: { row: PenaltyRow }) {
  return (
    <View style={styles.penaltyRow}>
      <View style={styles.penaltyHeader}>
        <Text style={styles.penaltyIcon}>{row.icon}</Text>
        <Text style={styles.penaltyCategory}>{row.category}</Text>
        <Text style={styles.penaltyPoints}>-{row.points}</Text>
      </View>
      <Text style={styles.penaltyDescription}>{row.description}</Text>
    </View>
  );
}

function SessionLimitsSection({ limits }: { limits: LimitRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>SESSION LIMITS</Text>
      {limits.map((limit, i) => (
        <View key={i} style={styles.capsRow}>
          <Text style={styles.capsLabel}>{limit.label}</Text>
          <Text style={[styles.capsValue, limit.restricted && styles.capsRestricted]}>
            {limit.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  scrollRoot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pending: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 200,
    fontFamily: MONO,
  },
  score: {
    fontSize: 64,
    fontWeight: '200',
    fontFamily: MONO,
    letterSpacing: 2,
    marginBottom: 4,
  },
  bandLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 12,
  },
  decisionLine: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  nudgesContainer: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  nudgeText: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    paddingLeft: 12,
  },
  positiveContainer: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  positiveText: {
    color: '#2ECC71',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    paddingLeft: 12,
  },
  syncHint: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
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
    marginBottom: 16,
  },
  penaltyRow: {
    marginBottom: 16,
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  penaltyIcon: {
    color: '#888888',
    fontSize: 14,
    width: 20,
  },
  penaltyCategory: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  penaltyPoints: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: MONO,
  },
  penaltyDescription: {
    color: '#888888',
    fontSize: 12,
    marginLeft: 20,
    lineHeight: 16,
  },
  totalLine: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  capsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  capsLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  capsValue: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: MONO,
  },
  capsRestricted: {
    color: '#F1C40F',
  },
  timestamp: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    marginTop: 32,
    letterSpacing: 1,
  },
  refreshButton: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  refreshText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: MONO,
  },
  refreshing: {
    color: '#333333',
  },
});
