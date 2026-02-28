import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getRecentActivities, type ActivityRow } from '../services/healthService';
import { getMeta } from '../services/metaStateService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const ZONE_LABELS: Record<number, string> = {
  1: 'Z1',
  2: 'Z2',
  3: 'Z3',
  4: 'Z4',
  5: 'Z5',
};

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [acts, syncTs] = await Promise.all([
      getRecentActivities(50),
      getMeta('last_sync_at'),
    ]);
    setActivities(acts);
    setLastSync(syncTs);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return <View style={styles.root} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>HEALTH</Text>

      {lastSync && (
        <Text style={styles.syncTs}>Last sync: {formatDate(lastSync)}</Text>
      )}

      <ScrollView style={styles.list}>
        {activities.length === 0 && (
          <Text style={styles.empty}>No activities recorded</Text>
        )}

        {activities.map(a => (
          <View key={a.localId} style={styles.activityRow}>
            <View style={styles.activityLeft}>
              <Text style={styles.activityDate}>
                {formatTimestamp(a.startTime)}
              </Text>
              <Text style={styles.activitySource}>
                {a.source.toUpperCase()}
              </Text>
            </View>
            <View style={styles.activityMiddle}>
              <Text style={styles.activityDuration}>
                {Math.round(a.durationMinutes)}m
              </Text>
              <Text style={styles.activityZone}>
                {ZONE_LABELS[a.derivedZone] ?? `Z${a.derivedZone}`}
              </Text>
            </View>
            <View style={styles.activityRight}>
              <Text style={styles.activityAsu}>
                {a.computedAsu.toFixed(1)}
              </Text>
              <Text style={[
                styles.syncFlag,
                a.syncedFlag ? styles.synced : styles.unsynced,
              ]}>
                {a.syncedFlag ? 'SYNCED' : 'PENDING'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 24,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  syncTs: {
    color: '#555555',
    fontSize: 10,
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  list: {
    flex: 1,
  },
  empty: {
    color: '#333333',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 80,
    fontFamily: MONO,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A1A',
  },
  activityLeft: {
    flex: 1,
  },
  activityDate: {
    color: '#EAEAEA',
    fontSize: 12,
    fontFamily: MONO,
  },
  activitySource: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  activityMiddle: {
    alignItems: 'center',
    width: 60,
  },
  activityDuration: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  activityZone: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    width: 64,
  },
  activityAsu: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  syncFlag: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  synced: {
    color: '#2ECC71',
  },
  unsynced: {
    color: '#F1C40F',
  },
});
