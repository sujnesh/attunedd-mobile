import type { CardioZone } from './types';

/**
 * Mirrors: StressCalculator::ZONE_INTENSITY (app/services/stress_calculator.rb:4-9)
 */
const ZONE_INTENSITY: Record<string, number> = {
  'Zone 2': 1.0,
  'Zone 3': 1.4,
  'Zone 4': 1.8,
  'Zone 5': 1.8,
};

/**
 * Mirrors: StressCalculator.planned_cardio_stress (app/services/stress_calculator.rb:56-70)
 *
 * Formula: durationMinutes * intensity
 * Unknown zones default to 1.0.
 */
export function calculateCardioStress(
  durationMinutes: number,
  zone: CardioZone | string,
): number {
  const intensity = ZONE_INTENSITY[zone] ?? 1.0;
  return durationMinutes * intensity;
}
