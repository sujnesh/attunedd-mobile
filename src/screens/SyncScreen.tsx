import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSyncStatus, type SyncStatus } from '../services/syncStatusService';
import { flushQueue, type FlushResult } from '../sync/syncEngine';
import { clearFailedEvents } from '../sync/eventQueue';
import { getMeta } from '../services/metaStateService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [lastResult, setLastResult] = useState<FlushResult | null>(null);

  const load = useCallback(async () => {
    const s = await getSyncStatus();
    setStatus(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleFlush = async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      const token = await getMeta('auth_token');
      if (!token) {
        setLastResult({ sent: 0, accepted: 0, rejected: 0, failed: 0 });
        return;
      }
      const result = await flushQueue(token);
      setLastResult(result);
      await load();
    } catch {
      // flush failure is non-fatal
    } finally {
      setFlushing(false);
    }
  };

  const handleClearFailed = async () => {
    await clearFailedEvents(3);
    await load();
  };

  if (!status) return <View style={styles.root} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>SYNC</Text>

      <View style={styles.statsBlock}>
        <StatRow label="PENDING" value={String(status.pendingCount)} />
        <StatRow
          label="FAILED"
          value={String(status.failedCount)}
          alert={status.failedCount > 0}
        />
        <StatRow label="VERSION" value={String(status.syncVersion)} />
        <StatRow
          label="LAST SYNC"
          value={status.lastSyncAt ? formatDate(status.lastSyncAt) : '—'}
        />
      </View>

      {lastResult && (
        <View style={styles.resultBlock}>
          <Text style={styles.resultTitle}>LAST FLUSH</Text>
          <Text style={styles.resultText}>
            Sent: {lastResult.sent}  Accepted: {lastResult.accepted}  Rejected: {lastResult.rejected}  Failed: {lastResult.failed}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={handleFlush}
          disabled={flushing}>
          <Text style={styles.actionText}>
            {flushing ? 'FLUSHING...' : 'FORCE FLUSH'}
          </Text>
        </Pressable>

        {status.failedCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && styles.pressed]}
            onPress={handleClearFailed}>
            <Text style={[styles.actionText, styles.dangerText]}>
              CLEAR FAILED
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatRow({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, alert && styles.statAlert]}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
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
    marginBottom: 32,
    textAlign: 'center',
  },
  statsBlock: {
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingTop: 16,
    marginBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  statLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  statValue: {
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
  },
  statAlert: {
    color: '#E74C3C',
  },
  resultBlock: {
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingTop: 16,
    marginBottom: 32,
  },
  resultTitle: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  resultText: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
  },
  actionBtn: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerBtn: {
    borderColor: '#E74C3C',
  },
  pressed: {
    backgroundColor: '#151515',
  },
  actionText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  dangerText: {
    color: '#E74C3C',
  },
});
