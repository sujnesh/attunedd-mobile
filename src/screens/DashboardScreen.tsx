import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadLatestEvaluation,
  triggerManualEvaluation,
  type ReadinessState,
} from '../services/readinessService';
import type { ParsedCaps } from '../services/metaStateService';

const BAND_COLORS: Record<string, string> = {
  green: '#2ECC71',
  yellow: '#F1C40F',
  red: '#E74C3C',
};

const BAND_LABELS: Record<string, string> = {
  green: 'OPTIMAL',
  yellow: 'SUBOPTIMAL',
  red: 'HIGH RISK',
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

  const accent = BAND_COLORS[data.band] ?? '#888888';
  const bandLabel = BAND_LABELS[data.band] ?? data.band.toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <Text style={[styles.score, { color: accent }]}>{data.score}</Text>
      <Text style={[styles.bandLabel, { color: accent }]}>{bandLabel}</Text>

      <CapsGrid caps={data.caps} />

      <Text style={styles.timestamp}>{formatTimestamp(data.timestamp)}</Text>

      <Pressable
        onPress={handleRefresh}
        style={styles.refreshButton}
        disabled={refreshing}>
        <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
          {refreshing ? 'REFRESHING' : 'REFRESH'}
        </Text>
      </Pressable>
    </View>
  );
}

function CapsGrid({ caps }: { caps: ParsedCaps }) {
  return (
    <View style={styles.capsBlock}>
      <CapsRow label="MAX RPE" value={String(caps.maxRpe)} />
      <CapsRow label="STRESS %" value={`${caps.maxStressPct}%`} />
      <CapsRow
        label="HEAVY NEURAL"
        value={caps.blockHeavyNeural ? 'BLOCKED' : 'ALLOWED'}
      />
      <CapsRow label="MAX ZONE" value={String(caps.maxCardioZone)} />
    </View>
  );
}

function CapsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.capsRow}>
      <Text style={styles.capsLabel}>{label}</Text>
      <Text style={styles.capsValue}>{value}</Text>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
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
    marginBottom: 48,
  },
  capsBlock: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222222',
    paddingTop: 24,
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
  timestamp: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    marginTop: 48,
    letterSpacing: 1,
  },
  refreshButton: {
    marginTop: 32,
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
