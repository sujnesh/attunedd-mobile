export interface SetData {
  rpe: number;
  reps: number;
}

export interface PolicyCaps {
  max_rpe: number;
  max_allowed_stress_pct: number;
  block_heavy_neural: boolean;
  max_cardio_zone: number;
}

export type RiskBand = 'optimal' | 'suboptimal' | 'high_risk';

export type ViolationType = 'heavy_neural_block' | 'rpe_cap' | 'stress_cap';

export interface EnforcementResult {
  allowed: boolean;
  violationType?: ViolationType;
}

export type CardioZone = 'Zone 2' | 'Zone 3' | 'Zone 4' | 'Zone 5';
