import type { SessionState } from './sessionState';
import { getNeuralLoadStatus } from './sessionState';

export function evaluateNudge(state: SessionState): string | null {
  const { cumulativeStress, allowedStress, caps } = state;

  if (allowedStress > 0) {
    const stressPct = (cumulativeStress / allowedStress) * 100;

    // Stress exceeded
    if (stressPct >= caps.max_allowed_stress_pct) {
      return 'Stress budget exceeded — consider finishing';
    }

    // Approaching stress cap (75-85% of allowed)
    if (stressPct >= 75 && stressPct < caps.max_allowed_stress_pct) {
      return `Approaching stress cap (${Math.round(stressPct)}%)`;
    }
  }

  // High neural load
  const neuralLoad = getNeuralLoadStatus(state);
  if (neuralLoad === 'high') {
    return 'High neural load — consider lighter movements';
  }

  return null;
}
