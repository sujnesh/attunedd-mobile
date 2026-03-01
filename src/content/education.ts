export interface EducationEntry {
  title: string;
  body: string;
  coachTip: string;
}

export type EducationTopic =
  | 'rpe'
  | 'rpe_target'
  | 'zone_1'
  | 'zone_2'
  | 'zone_3'
  | 'zone_4'
  | 'zone_5'
  | 'adaptation_score'
  | 'risk_band'
  | 'stress_units'
  | 'stress_budget'
  | 'hrv'
  | 'resting_hr'
  | 'strain'
  | 'recovery_score'
  | 'coaching_mode'
  | 'rep_range'
  | 'sets'
  | 'override'
  | 'fatigue_detected';

export const EDUCATION: Record<EducationTopic, EducationEntry> = {
  rpe: {
    title: 'Rate of Perceived Exertion',
    body: 'RPE is a scale of 1-10 that measures how hard a set felt. RPE 7 means you could have done about 3 more reps. RPE 8 means 2 more reps. RPE 10 means absolute failure — you couldn\u2019t do one more rep.',
    coachTip: 'Most training happens at RPE 6-8. Save RPE 9-10 for testing days.',
  },
  rpe_target: {
    title: 'Why RPE Targets?',
    body: 'Training at the right effort level maximizes gains without overtraining. Too easy and you won\u2019t stimulate growth. Too hard every session and your body can\u2019t recover. RPE targets keep you in the productive zone.',
    coachTip: 'Hit the target RPE, not a specific weight. Some days you\u2019re stronger than others.',
  },
  zone_1: {
    title: 'Zone 1 \u2014 Recovery',
    body: 'Very easy pace. You can hold a full conversation without any breathlessness. Heart rate around 50-60% of your max. This zone promotes blood flow and recovery without adding training stress.',
    coachTip: 'If you can\u2019t talk normally, you\u2019re going too hard for Zone 1.',
  },
  zone_2: {
    title: 'Zone 2 \u2014 Aerobic Base',
    body: 'Conversational pace. You can speak in full sentences but with slight effort. Heart rate around 60-70% of max. This is where most endurance benefits happen \u2014 your body gets better at burning fat and using oxygen.',
    coachTip: 'Zone 2 should feel easy. Most people go too hard here. Slow down.',
  },
  zone_3: {
    title: 'Zone 3 \u2014 Tempo',
    body: 'Comfortably hard. You can speak in short sentences but not hold a conversation. Heart rate around 70-80% of max. Good for building lactate threshold.',
    coachTip: 'Tempo runs improve your ability to sustain faster paces over time.',
  },
  zone_4: {
    title: 'Zone 4 \u2014 Threshold',
    body: 'Hard. You can only say a few words at a time. Heart rate around 80-90% of max. This zone builds speed and power but creates significant fatigue.',
    coachTip: 'Limit Zone 4 work to intervals. Sustained Zone 4 burns you out fast.',
  },
  zone_5: {
    title: 'Zone 5 \u2014 Max Effort',
    body: 'All-out effort. You can\u2019t speak. Sprint pace. Heart rate 90-100% of max. Used for short bursts \u2014 sprints, hill charges, finishing kicks. Very taxing on the nervous system.',
    coachTip: 'Zone 5 intervals should be short (10-60 seconds) with full recovery between.',
  },
  adaptation_score: {
    title: 'Your Readiness Score',
    body: 'A 0-100 score reflecting how recovered and ready to train you are right now. It combines your recent training load, recovery patterns, and WHOOP data (if connected). Higher = more ready to push hard.',
    coachTip: 'Don\u2019t chase a high score. Use it to decide how hard to go today.',
  },
  risk_band: {
    title: 'Risk Bands',
    body: 'Your readiness score maps to a color band. Green (Optimal) means you\u2019re recovered \u2014 push hard. Yellow (Suboptimal) means moderate recovery \u2014 train smart with reduced intensity. Red (High Risk) means you\u2019re under-recovered \u2014 rest or go very light.',
    coachTip: 'Yellow days are still training days. Just respect the intensity caps.',
  },
  stress_units: {
    title: 'Stress Units',
    body: 'How we measure workout load in a single number. Combines weight lifted, reps performed, and effort level (RPE) into one comparable metric. More stress units = harder workout.',
    coachTip: 'Track your stress units over weeks. Gradual increases mean you\u2019re progressing.',
  },
  stress_budget: {
    title: 'Stress Budget',
    body: 'Your allowed training load for today\u2019s session. Calculated from your recovery status and recent training history. Going over budget occasionally is fine, but consistently exceeding it leads to overtraining.',
    coachTip: 'Think of it like a spending limit. Prioritize compound lifts first.',
  },
  hrv: {
    title: 'Heart Rate Variability',
    body: 'HRV measures the variation in time between heartbeats. Higher HRV generally means better recovery and a more adaptive nervous system. It naturally fluctuates day to day \u2014 trends matter more than single readings.',
    coachTip: 'A sudden HRV drop might mean poor sleep, stress, or illness. Take it easy.',
  },
  resting_hr: {
    title: 'Resting Heart Rate',
    body: 'Your heart rate when fully at rest. A lower resting HR generally indicates better cardiovascular fitness. An elevated resting HR compared to your baseline can signal fatigue, dehydration, or stress.',
    coachTip: 'Check trends over weeks, not individual days. 3-5 bpm above baseline is notable.',
  },
  strain: {
    title: 'WHOOP Strain',
    body: 'WHOOP\u2019s measure of cumulative cardiovascular load for the day, on a scale of 0-21. It\u2019s based on heart rate data throughout the day. Higher strain means more cardiovascular stress accumulated.',
    coachTip: 'Match your strain to your recovery. High recovery = can handle higher strain.',
  },
  recovery_score: {
    title: 'WHOOP Recovery',
    body: 'WHOOP\u2019s 0-100% recovery score based on sleep, HRV, and resting heart rate. Green (67%+) means well recovered. Yellow (34-66%) means moderate. Red (under 34%) means you need rest.',
    coachTip: 'Recovery is mostly driven by sleep. Prioritize 7-9 hours for better scores.',
  },
  coaching_mode: {
    title: 'Coaching Modes',
    body: 'Your coach adjusts session intensity based on your readiness. Push mode means go hard \u2014 you\u2019re well recovered. Maintain mode is standard training. Fatigue Management mode reduces volume and intensity to help you recover.',
    coachTip: 'Trust the mode. Fatigue management days build long-term consistency.',
  },
  rep_range: {
    title: 'Rep Ranges',
    body: 'Different rep ranges train different qualities. 1-5 reps builds maximal strength. 6-12 reps is the hypertrophy (muscle growth) sweet spot. 12+ reps builds muscular endurance. Your plan uses the range that matches your goal.',
    coachTip: 'Stay within the prescribed range. If you hit the top easily, add weight next set.',
  },
  sets: {
    title: 'Sets',
    body: 'A set is one group of consecutive reps. "4\u00D78" means 4 sets of 8 reps. More sets per muscle per week = more growth stimulus, up to a point. Your plan balances total sets across muscle groups.',
    coachTip: 'Quality sets matter more than quantity. Each set should be challenging.',
  },
  override: {
    title: 'Overriding a Cap',
    body: 'When your coach sets a limit (like max RPE 8), you can choose to push past it. This is tracked and affects future recommendations. Occasional overrides are fine \u2014 your coach will adjust. Frequent overrides signal that caps may be too conservative.',
    coachTip: 'Override when you genuinely feel good. Not just because you want to push.',
  },
  fatigue_detected: {
    title: 'Fatigue Detection',
    body: 'When your last 2 sets show declining performance \u2014 higher effort for fewer reps, or same weight feeling harder \u2014 it means the muscle is fatiguing. This is a signal to consider moving to the next exercise rather than grinding out more sets.',
    coachTip: 'Fatigue flags aren\u2019t failures. They\u2019re smart signals to redirect your energy.',
  },
};
