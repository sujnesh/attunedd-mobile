import { AppState, type NativeEventSubscription } from 'react-native';
import { registerScheduler, executeBackgroundTask } from './scheduler';
import { runEvaluation } from './evaluationEngine';
import { configureNotifications } from './notificationPolicy';

let initialized = false;
let appStateSubscription: NativeEventSubscription | null = null;

export async function initializeBackgroundSystem(): Promise<void> {
  if (initialized) return;
  initialized = true;

  configureNotifications();
  await registerScheduler();

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  await runEvaluation();
}

let lastForegroundEvaluation = 0;
const MIN_EVALUATION_INTERVAL = 60 * 60 * 1000;

async function handleAppStateChange(nextState: string): Promise<void> {
  if (nextState !== 'active') return;

  const now = Date.now();
  if (now - lastForegroundEvaluation < MIN_EVALUATION_INTERVAL) return;

  lastForegroundEvaluation = now;
  await runEvaluation();
}

export function teardownBackgroundSystem(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  initialized = false;
}
