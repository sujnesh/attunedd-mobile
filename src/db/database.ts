import SQLite, { type SQLiteDatabase } from 'react-native-sqlite-storage';
import { runMigrations } from './migrations';

SQLite.enablePromise(true);

const DB_NAME = 'attunedd.db';
const DB_LOCATION = 'default';

let dbInstance: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabase({
    name: DB_NAME,
    location: DB_LOCATION,
  });

  await db.executeSql('PRAGMA journal_mode = WAL;');
  await db.executeSql('PRAGMA foreign_keys = ON;');

  await runMigrations(db);

  dbInstance = db;
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export async function executeSql(
  sql: string,
  params: (string | number | null)[] = []
): Promise<[SQLite.ResultSet]> {
  const db = await getDatabase();
  return db.executeSql(sql, params);
}

export function generateUUID(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let s = '';
      for (let i = 0; i < len; i++) {
        s += hex[Math.floor(Math.random() * 16)];
      }
      return s;
    })
    .join('-');
}

export function nowISO(): string {
  return new Date().toISOString();
}
