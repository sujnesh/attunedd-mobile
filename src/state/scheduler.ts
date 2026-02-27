import BackgroundFetch from 'react-native-background-fetch';
import { executeSql } from '../db/database';
import { ingestDeviceActivities } from '../health/ingestionEngine';
import { runEvaluation } from './evaluationEngine';

const TASK_ID = 'com.attunedd.daily-evaluation';
const TARGET_HOUR = 5;

export async function registerScheduler(): Promise<void> {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
    },
    async (taskId: string) => {
      await executeBackgroundTask();
      BackgroundFetch.finish(taskId);
    },
    async (taskId: string) => {
      BackgroundFetch.finish(taskId);
    }
  );

  await BackgroundFetch.scheduleTask({
    taskId: TASK_ID,
    delay: computeDelayToNextTarget(),
    periodic: false,
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
    requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
  });
}

export async function executeBackgroundTask(): Promise<void> {
  const userAge = await getUserAge();
  const authToken = await getAuthToken();

  if (!authToken) return;

  try {
    await ingestDeviceActivities(userAge, authToken);
  } catch {
    // Ingestion failure must not block evaluation
  }

  await runEvaluation();

  await rescheduleDaily();
}

async function rescheduleDaily(): Promise<void> {
  try {
    await BackgroundFetch.scheduleTask({
      taskId: TASK_ID,
      delay: computeDelayToNextTarget(),
      periodic: false,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
    });
  } catch {
    // Schedule failure is non-fatal
  }
}

function computeDelayToNextTarget(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(TARGET_HOUR, 0, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

async function getUserAge(): Promise<number> {
  const [result] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'user_age';`
  );
  if (result.rows.length > 0) {
    return parseInt(result.rows.item(0).value, 10) || 30;
  }
  return 30;
}

async function getAuthToken(): Promise<string | null> {
  const [result] = await executeSql(
    `SELECT value FROM meta_state WHERE key = 'auth_token';`
  );
  if (result.rows.length > 0) {
    return result.rows.item(0).value;
  }
  return null;
}
