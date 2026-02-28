import { runEvaluation } from '../state/evaluationEngine';
import { getEvaluationSnapshot, type EvaluationData } from './metaStateService';

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

let refreshInFlight = false;

export interface ReadinessState {
  data: EvaluationData;
  isStale: boolean;
}

export async function loadLatestEvaluation(): Promise<ReadinessState> {
  const data = await getEvaluationSnapshot();
  const isStale = data.timestamp != null
    ? Date.now() - data.timestamp > STALE_THRESHOLD_MS
    : data.score != null;

  if (isStale) {
    await triggerManualEvaluation();
    const refreshed = await getEvaluationSnapshot();
    return { data: refreshed, isStale: false };
  }

  return { data, isStale: false };
}

export async function triggerManualEvaluation(): Promise<EvaluationData> {
  if (refreshInFlight) {
    return getEvaluationSnapshot();
  }

  refreshInFlight = true;
  try {
    await runEvaluation();
    return getEvaluationSnapshot();
  } finally {
    refreshInFlight = false;
  }
}
