import { DBSchema, IDBPDatabase, openDB } from 'idb';
import type { CheckIn, CustomWord, SessionRecord } from '../../core/tracking/types';

interface Schema extends DBSchema {
  kv: { key: string; value: unknown };
  sessions: { key: string; value: SessionRecord; indexes: { 'by-start': number } };
  customWords: { key: string; value: CustomWord };
  checkins: { key: string; value: CheckIn };
}

/**
 * Local-only progress storage in IndexedDB. Stores numbers and the user's own word list —
 * never audio, never loudness traces.
 */
export class ProgressDb {
  private db: Promise<IDBPDatabase<Schema>>;

  constructor(name = 'deblocker') {
    this.db = openDB<Schema>(name, 1, {
      upgrade(db) {
        db.createObjectStore('kv');
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('by-start', 'startedAt');
        db.createObjectStore('customWords', { keyPath: 'id' });
        db.createObjectStore('checkins', { keyPath: 'date' });
      },
    });
  }

  async getKv<T>(key: string): Promise<T | undefined> {
    return (await (await this.db).get('kv', key)) as T | undefined;
  }
  async setKv<T>(key: string, value: T): Promise<void> {
    await (await this.db).put('kv', value, key);
  }
  async addSession(s: SessionRecord) { await (await this.db).put('sessions', s); }
  async listSessions(): Promise<SessionRecord[]> {
    return (await this.db).getAllFromIndex('sessions', 'by-start');
  }
  async addWord(w: CustomWord) { await (await this.db).put('customWords', w); }
  async removeWord(id: string) { await (await this.db).delete('customWords', id); }
  async listWords(): Promise<CustomWord[]> {
    return ((await (await this.db).getAll('customWords')) as CustomWord[]).sort((a, b) => a.addedAt - b.addedAt);
  }
  async putCheckin(c: CheckIn) { await (await this.db).put('checkins', c); }
  async listCheckins(): Promise<CheckIn[]> { return (await this.db).getAll('checkins'); }
  async clearAll() {
    const db = await this.db;
    await Promise.all(['kv', 'sessions', 'customWords', 'checkins'].map((s) => db.clear(s as 'kv')));
  }
}
