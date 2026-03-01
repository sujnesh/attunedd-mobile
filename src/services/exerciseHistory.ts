import { executeSql } from '../db/database';

/**
 * Returns distinct exercise names the user has logged, ordered by recency.
 * Results are cached in-memory for the session.
 */
let cachedNames: string[] | null = null;

export async function getExerciseHistory(): Promise<string[]> {
  if (cachedNames) return cachedNames;

  const [result] = await executeSql(
    `SELECT exercise_name, MAX(created_at) as last_used
     FROM exercise_sets
     GROUP BY LOWER(exercise_name)
     ORDER BY last_used DESC
     LIMIT 100;`
  );

  const names: string[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    names.push(result.rows.item(i).exercise_name);
  }
  cachedNames = names;
  return names;
}

export function invalidateExerciseCache(): void {
  cachedNames = null;
}

/**
 * Filter exercise names by a prefix query string.
 * Matches anywhere in the name (not just start).
 */
export function filterExercises(names: string[], query: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return names.filter((n) => n.toLowerCase().includes(q)).slice(0, 5);
}
