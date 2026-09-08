import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { IndexDb } from '../src/app/classes/index-db';
import { eq, limit, sort, sortNumber } from '../src/app/operators';


const STORE = 'account';

// Each test gets a pristine IndexedDB; IndexDb hardcodes the database name/version
// handling, so a shared factory would leak store state between tests.
function resetIndexedDb(): void {
  (globalThis as any).indexedDB = new IDBFactory();
}

async function createStore(indexDb: IndexDb, name = STORE, indexes: string[] = []): Promise<void> {
  const describe = await firstValueFrom(indexDb.describe);

  await firstValueFrom(indexDb.upgrade(describe.version + 1, (event: any) => {
    const db = event.target.result;
    const objectStore = db.createObjectStore(name, { keyPath: 'id' });

    indexes.forEach((index) => objectStore.createIndex(index, index, { unique: false }));
  }));
}

describe('IndexDb', () => {
  let indexDb: IndexDb;

  beforeEach(async () => {
    resetIndexedDb();
    indexDb = new IndexDb();
    await createStore(indexDb);
  });

  afterEach(() => {
    resetIndexedDb();
  });

  it('describes the database version and stores', async () => {
    const description = await firstValueFrom(indexDb.describe);

    expect(description.objectStoreNames).toContain(STORE);
    expect(description.version).toBeGreaterThan(0);
  });

  it('puts and gets a record', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1', country: 'Canada' }));

    const record = await firstValueFrom(indexDb.get(STORE, '1'));

    expect(record).toEqual({ id: '1', country: 'Canada' });
  });

  it('returns null for a null/undefined key rather than throwing', async () => {
    expect(await firstValueFrom(indexDb.get(STORE, null))).toBeNull();
    expect(await firstValueFrom(indexDb.get(STORE, undefined))).toBeNull();
  });

  it('returns undefined for a key that is absent', async () => {
    expect(await firstValueFrom(indexDb.get(STORE, 'nope'))).toBeUndefined();
  });

  it('overwrites a record with the same key', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1', country: 'Canada' }));
    await firstValueFrom(indexDb.put(STORE, { id: '1', country: 'Sweden' }));

    const data = await firstValueFrom(indexDb.data(STORE, []));

    expect(data.length).toBe(1);
    expect(data[0].country).toBe('Sweden');
  });

  it('deletes a single key', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1' }));
    await firstValueFrom(indexDb.delete(STORE, ['1']));

    expect(await firstValueFrom(indexDb.data(STORE, []))).toEqual([]);
  });

  // Regression: delete() previously used concat, which subscribes lazily. An
  // IndexedDB transaction auto-commits once the event loop yields with no pending
  // requests, so the second delete hit an already-committed transaction and threw
  // TransactionInactiveError. Anything beyond a single key must still work.
  //
  // NOTE: fake-indexeddb keeps transactions alive more permissively than a real
  // browser, so this test passes under both concat and merge. It guards the
  // behaviour (all keys deleted), not the timing bug itself — verify that in a
  // real browser.
  it('deletes many keys in one transaction', async () => {
    const ids = Array.from({ length: 25 }, (_, index) => String(index));

    for (const id of ids) {
      await firstValueFrom(indexDb.put(STORE, { id }));
    }

    expect((await firstValueFrom(indexDb.data(STORE, []))).length).toBe(25);

    await firstValueFrom(indexDb.delete(STORE, ids));

    expect(await firstValueFrom(indexDb.data(STORE, []))).toEqual([]);
  });

  it('deletes a subset and leaves the rest intact', async () => {
    for (const id of ['1', '2', '3', '4']) {
      await firstValueFrom(indexDb.put(STORE, { id }));
    }

    await firstValueFrom(indexDb.delete(STORE, ['2', '3']));

    const remaining = (await firstValueFrom(indexDb.data(STORE, [])))
      .map((item) => item.id)
      .sort();

    expect(remaining).toEqual(['1', '4']);
  });

  it('accepts a bare (non-array) key for delete', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1' }));
    await firstValueFrom(indexDb.delete(STORE, '1' as any));

    expect(await firstValueFrom(indexDb.data(STORE, []))).toEqual([]);
  });

  it('deleting an empty key list is a no-op', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1' }));
    await firstValueFrom(indexDb.delete(STORE, []));

    expect((await firstValueFrom(indexDb.data(STORE, []))).length).toBe(1);
  });

  it('deleting a key that does not exist resolves without error', async () => {
    await expect(firstValueFrom(indexDb.delete(STORE, ['ghost']))).resolves.toBeDefined();
  });

  it('clears every record', async () => {
    await firstValueFrom(indexDb.put(STORE, { id: '1' }));
    await firstValueFrom(indexDb.put(STORE, { id: '2' }));
    await firstValueFrom(indexDb.clear(STORE));

    expect(await firstValueFrom(indexDb.data(STORE, []))).toEqual([]);
  });

  describe('data()', () => {
    beforeEach(async () => {
      const rows = [
        { id: '1', country: 'Canada', areaId: 3 },
        { id: '2', country: 'Sweden', areaId: 1 },
        { id: '3', country: 'Indonesia', areaId: 2 },
      ];

      for (const row of rows) {
        await firstValueFrom(indexDb.put(STORE, row));
      }
    });

    it('returns every record with no operators', async () => {
      expect((await firstValueFrom(indexDb.data(STORE, []))).length).toBe(3);
    });

    it('applies a filter operator', async () => {
      const data = await firstValueFrom(indexDb.data(STORE, [eq('country', 'Sweden')]));

      expect(data.length).toBe(1);
      expect(data[0].id).toBe('2');
    });

    it('sorts by a string field', async () => {
      const data = await firstValueFrom(indexDb.data(STORE, [sort('country')]));

      expect(data.map((item) => item.country)).toEqual(['Canada', 'Indonesia', 'Sweden']);
    });

    it('sorts descending', async () => {
      const data = await firstValueFrom(indexDb.data(STORE, [sort('country', 'desc')]));

      expect(data.map((item) => item.country)).toEqual(['Sweden', 'Indonesia', 'Canada']);
    });

    it('sorts numerically', async () => {
      const data = await firstValueFrom(indexDb.data(STORE, [sortNumber('areaId')]));

      expect(data.map((item) => item.areaId)).toEqual([1, 2, 3]);
    });

    it('applies limit after sorting', async () => {
      const data = await firstValueFrom(
        indexDb.data(STORE, [sortNumber('areaId'), limit(2)]),
      );

      expect(data.map((item) => item.areaId)).toEqual([1, 2]);
    });

    it('applies limit with an offset', async () => {
      const data = await firstValueFrom(
        indexDb.data(STORE, [sortNumber('areaId'), limit(2, 1)]),
      );

      expect(data.map((item) => item.areaId)).toEqual([2, 3]);
    });

    it('returns an empty array when the offset is past the end', async () => {
      const data = await firstValueFrom(indexDb.data(STORE, [limit(2, 99)]));

      expect(data).toEqual([]);
    });
  });
});

// Regression: after destroy() removes an object store, every subsequent read/write
// threw NotFoundError ("One of the specified object stores was not found"), which
// killed the sync loop permanently. Missing store must degrade gracefully.
describe('IndexDb against a missing object store', () => {
  let indexDb: IndexDb;

  beforeEach(() => {
    resetIndexedDb();
    indexDb = new IndexDb();
  });

  afterEach(() => {
    resetIndexedDb();
  });

  it('get returns undefined instead of throwing', async () => {
    await expect(firstValueFrom(indexDb.get('ghost', '1'))).resolves.toBeUndefined();
  });

  it('data returns an empty array instead of throwing', async () => {
    await expect(firstValueFrom(indexDb.data('ghost', []))).resolves.toEqual([]);
  });

  it('put resolves instead of throwing', async () => {
    await expect(firstValueFrom(indexDb.put('ghost', { id: '1' }))).resolves.toBeNull();
  });

  it('delete resolves instead of throwing', async () => {
    await expect(firstValueFrom(indexDb.delete('ghost', ['1']))).resolves.toEqual([]);
  });

  it('clear resolves instead of throwing', async () => {
    await expect(firstValueFrom(indexDb.clear('ghost'))).resolves.toBeNull();
  });

  it('surviving stores still work after another store is destroyed', async () => {
    await createStore(indexDb, 'account');
    await firstValueFrom(indexDb.put('account', { id: '1', country: 'Canada' }));

    // 'ghost' never existed; reading it must not disturb 'account'.
    await firstValueFrom(indexDb.data('ghost', []));

    expect((await firstValueFrom(indexDb.data('account', []))).length).toBe(1);
  });
});

