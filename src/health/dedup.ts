import { executeSql } from '../db/database';
import type { NormalizedActivity } from './types';

export function generateActivityHash(activity: NormalizedActivity): string {
  const input = [
    activity.source,
    String(activity.start_time),
    String(activity.duration_minutes),
    activity.distance_m !== null ? String(activity.distance_m) : 'null',
    activity.avg_hr !== null ? String(activity.avg_hr) : 'null',
  ].join('|');

  return sha256(input);
}

export async function activityExists(hash: string): Promise<boolean> {
  const [results] = await executeSql(
    `SELECT 1 FROM external_activities WHERE activity_hash = ? LIMIT 1;`,
    [hash]
  );
  return results.rows.length > 0;
}

function sha256(input: string): string {
  // Deterministic hash using djb2 + secondary hash for collision resistance
  // Production note: replace with crypto.subtle.digest when available
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x100193);
  }

  h1 = h1 >>> 0;
  h2 = h2 >>> 0;

  const p1 = h1.toString(16).padStart(8, '0');
  const p2 = h2.toString(16).padStart(8, '0');

  // Extend to 64 hex chars by mixing rounds
  let h3 = h1 ^ 0xa5a5a5a5;
  let h4 = h2 ^ 0x5a5a5a5a;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h3 = Math.imul(h3 ^ c, 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ c, 0x100193) >>> 0;
  }

  const p3 = h3.toString(16).padStart(8, '0');
  const p4 = h4.toString(16).padStart(8, '0');

  let h5 = h1 ^ h2;
  let h6 = h3 ^ h4;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h5 = Math.imul(h5 ^ c, 0x1677619) >>> 0;
    h6 = Math.imul(h6 ^ c, 0x50c5d1f) >>> 0;
  }

  const p5 = h5.toString(16).padStart(8, '0');
  const p6 = h6.toString(16).padStart(8, '0');

  let h7 = h1 ^ h4;
  let h8 = h2 ^ h3;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h7 = Math.imul(h7 ^ c, 0x6b43a33) >>> 0;
    h8 = Math.imul(h8 ^ c, 0x3f6b562d) >>> 0;
  }

  const p7 = h7.toString(16).padStart(8, '0');
  const p8 = h8.toString(16).padStart(8, '0');

  return p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8;
}
