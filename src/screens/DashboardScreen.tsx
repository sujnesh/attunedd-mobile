import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { executeSql } from '../db/database';
import { deriveCaps, type PolicyCaps } from '../state/evaluationEngine';

interface DashboardData {
  score: number;
  riskBand: string;
  caps: PolicyCaps;
  timestamp: number;
}

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

async function loadDashboardData(): Promise<DashboardData | null> {
  const keys = [
    'last_adaptation_score',
    'last_risk_band',
    'last_evaluation_timestamp',
  ];

  const [result] = await executeSql(
    `SELECT key, value FROM meta_state WHERE key IN (?, ?, ?);`,
    keys
  );

  if (result.rows.length === 0) return null;

  const map: Record<string, string> = {};
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    map[row.key] = row.value;
  }

  if (!map.last_adaptation_score || !map.last_risk_band) return null;

  const riskBand = map.last_risk_band;

  return {
    score: Math.round(parseFloat(map.last_adaptation_score)),
    riskBand,
    caps: deriveCaps(riskBand),
    timestamp: parseInt(map.last_evaluation_timestamp || '0', 10),
  };
}

function formatTimestamp(ts: number): string {
  if (ts <= 0) return '—';
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}  ${hours}:${minutes}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadDashboardData()
      .then((d) => {
        setData(d);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return <View style={styles.root} />;

  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.pending}>Evaluation pending...</Text>
      </View>
    );
  }

  const accent = BAND_COLORS[data.riskBand] ?? '#888888';
  const bandLabel = BAND_LABELS[data.riskBand] ?? data.riskBand.toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <Text style={[styles.score, { color: accent }]}>{data.score}</Text>
      <Text style={[styles.bandLabel, { color: accent }]}>{bandLabel}</Text>

      <View style={styles.capsBlock}>
        <CapsRow label="MAX RPE" value={String(data.caps.max_rpe)} />
        <CapsRow label="STRESS %" value={`${data.caps.max_allowed_stress_pct}%`} />
        <CapsRow label="HEAVY NEURAL" value={data.caps.block_heavy_neural ? 'BLOCKED' : 'ALLOWED'} />
        <CapsRow label="MAX ZONE" value={String(data.caps.max_cardio_zone)} />
      </View>

      <Text style={styles.timestamp}>{formatTimestamp(data.timestamp)}</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pending: {
    flex: 1,
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    marginTop: 200,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  score: {
    fontSize: 64,
    fontWeight: '200',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestamp: {
    color: '#888888',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 48,
    letterSpacing: 1,
  },
});
