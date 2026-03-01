import { getMeta, setMeta } from './metaStateService';

export interface CheckInData {
  energy: number;     // 1-5
  sleepQuality: number; // 1-5
  soreness: number;   // 1-5
  note?: string;
}

export async function saveCheckIn(data: CheckInData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await setMeta('last_checkin_json', JSON.stringify(data));
  await setMeta('last_checkin_date', today);
}

export async function getLastCheckIn(): Promise<CheckInData | null> {
  const raw = await getMeta('last_checkin_json');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckInData;
  } catch {
    return null;
  }
}

export function shouldShowCheckIn(lastDate: string | null): boolean {
  if (!lastDate) return true;
  const today = new Date().toISOString().slice(0, 10);
  return lastDate !== today;
}

export function getCheckInContext(data: CheckInData): string[] {
  const bullets: string[] = [];
  if (data.energy <= 2) bullets.push('Low energy noted');
  if (data.sleepQuality <= 2) bullets.push('Poor sleep reported');
  if (data.soreness >= 4) bullets.push('High soreness noted');
  return bullets;
}
