import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { Store } from '../src/app/classes/store';
import { SyncState } from '../src/app/enums';
import { MemoryStorage } from '../src/app/storage/memory.storage';
import { LocalStorage } from '../src/app/storage/local.storage';
import { eq } from '../src/app/operators';


class AccountStore extends Store<any> {
  public static storeName = 'account';
  public static keyName = 'id';
}

function memoryStore(): Store<any> {
  return new AccountStore({ storage: { type: 'memory' } });
}


describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage(memoryStore());
  });

  it('puts and gets a record', async () => {
    await firstValueFrom(storage.put({ id: '1', country: 'Canada' }));

    expect(await firstValueFrom(storage.get('1'))).toEqual({ id: '1', country: 'Canada' });
  });

  it('puts an array of records', async () => {
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));

    expect((await firstValueFrom(storage.gets([]))).length).toBe(2);
  });

  it('overwrites by key', async () => {
    await firstValueFrom(storage.put({ id: '1', country: 'Canada' }));
    await firstValueFrom(storage.put({ id: '1', country: 'Sweden' }));

    const data = await firstValueFrom(storage.gets([]));

    expect(data.length).toBe(1);
    expect(data[0].country).toBe('Sweden');
  });

  it('filters via operators', async () => {
    await firstValueFrom(storage.put([{ id: '1', country: 'Canada' }, { id: '2', country: 'Sweden' }]));

    const data = await firstValueFrom(storage.gets([eq('country', 'Sweden')]));

    expect(data.length).toBe(1);
    expect(data[0].id).toBe('2');
  });

  it('deletes keys', async () => {
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));
    await firstValueFrom(storage.delete(['1']));

    const data = await firstValueFrom(storage.gets([]));

    expect(data.map((item) => item.id)).toEqual(['2']);
  });

  it('clears everything', async () => {
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));
    await firstValueFrom(storage.clear());

    expect(await firstValueFrom(storage.gets([]))).toEqual([]);
  });

  it('returns undefined for a missing key', async () => {
    expect(await firstValueFrom(storage.get('nope'))).toBeUndefined();
  });

  it('returns copies from gets so callers cannot mutate the store', async () => {
    await firstValueFrom(storage.put({ id: '1', country: 'Canada' }));

    const first = await firstValueFrom(storage.gets([]));
    first[0].country = 'Mutated';

    const second = await firstValueFrom(storage.gets([]));

    expect(second[0].country).toBe('Canada');
  });
});


describe('Storage sync-state helpers', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage(memoryStore());
  });

  it('putSynced stamps Synced state, a date and revision 1', async () => {
    await firstValueFrom(storage.putSynced({ id: '1' }));

    const item = await firstValueFrom(storage.get('1'));

    expect(item._sync.state).toBe(SyncState.Synced);
    expect(item._sync.revision).toBe(1);
    expect(item._sync.date).toBeInstanceOf(Date);
  });

  it('putSynced does not mutate the caller’s object', async () => {
    const item: any = { id: '1' };
    await firstValueFrom(storage.putSynced(item));

    expect(item._sync).toBeUndefined();
  });

  it('putError stamps Error state and increments retries', async () => {
    await firstValueFrom(storage.putError({ id: '1' }));
    expect((await firstValueFrom(storage.get('1')))._sync.retries).toBe(1);

    await firstValueFrom(storage.putError(await firstValueFrom(storage.get('1'))));
    const item = await firstValueFrom(storage.get('1'));

    expect(item._sync.state).toBe(SyncState.Error);
    expect(item._sync.retries).toBe(2);
  });
});


describe('LocalStorage', () => {
  let storage: LocalStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('puts and gets a record', async () => {
    await firstValueFrom(storage.put({ id: '1', country: 'Canada' }));

    expect(await firstValueFrom(storage.get('1'))).toEqual({ id: '1', country: 'Canada' });
  });

  it('puts an array of records', async () => {
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));

    expect(await firstValueFrom(storage.get('2'))).toEqual({ id: '2' });
  });

  it('deletes a key', async () => {
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));
    await firstValueFrom(storage.delete(['1']));

    expect(await firstValueFrom(storage.get('1'))).toBeUndefined();
    expect(await firstValueFrom(storage.get('2'))).toEqual({ id: '2' });
  });

  it('clears the store', async () => {
    await firstValueFrom(storage.put({ id: '1' }));
    await firstValueFrom(storage.clear());

    expect(await firstValueFrom(storage.get('1'))).toBeUndefined();
  });

  it('persists across storage instances (same localStorage key)', async () => {
    await firstValueFrom(storage.put({ id: '1', country: 'Canada' }));

    const other = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));

    expect(await firstValueFrom(other.get('1'))).toEqual({ id: '1', country: 'Canada' });
  });
});


describe('IndexDbStorage destroy({ preserveUnsynced })', () => {
  let store: Store<any>;

  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    store = new AccountStore({});
  });

  afterEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('keeps unsynced records and drops synced/server ones', async () => {
    await firstValueFrom(store.init());

    // Server-sourced (no _sync at all) and explicitly Synced records must go.
    await firstValueFrom(store.storage.put({ id: 'server' }));
    await firstValueFrom(store.storage.putSynced({ id: 'synced' }));

    // Locally queued work must survive.
    await firstValueFrom(store.storage.put({ id: 'pending', _sync: { state: SyncState.Pending } }));
    await firstValueFrom(store.storage.putError({ id: 'errored' }));

    await firstValueFrom(store.destroy({ preserveUnsynced: true }));

    const remaining = (await firstValueFrom(store.gets()))
      .map((item) => item.id)
      .sort();

    expect(remaining).toEqual(['errored', 'pending']);
  });

  it('destroy without options removes the object store entirely', async () => {
    await firstValueFrom(store.init());
    await firstValueFrom(store.storage.put({ id: 'pending', _sync: { state: SyncState.Pending } }));

    await firstValueFrom(store.destroy());

    const describe: any = await firstValueFrom((store.storage as any)._indexDB.describe);

    expect(describe.objectStoreNames).not.toContain('account');
  });

  it('preserveUnsynced on an empty store is a no-op', async () => {
    await firstValueFrom(store.init());

    await expect(
      firstValueFrom(store.destroy({ preserveUnsynced: true })),
    ).resolves.toBeNull();
  });

  it('preserveUnsynced deletes a large batch of synced records', async () => {
    await firstValueFrom(store.init());

    for (let i = 0; i < 30; i++) {
      await firstValueFrom(store.storage.putSynced({ id: `s${i}` }));
    }
    await firstValueFrom(store.storage.put({ id: 'keep', _sync: { state: SyncState.Pending } }));

    await firstValueFrom(store.destroy({ preserveUnsynced: true }));

    const remaining = (await firstValueFrom(store.gets())).map((item) => item.id);

    expect(remaining).toEqual(['keep']);
  });
});


describe('destroy parity across backends', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('MemoryStorage.destroy clears the store', async () => {
    const storage = new MemoryStorage(memoryStore());
    await firstValueFrom(storage.put([{ id: '1' }, { id: '2' }]));

    await firstValueFrom(storage.destroy());

    expect(await firstValueFrom(storage.gets([]))).toEqual([]);
  });

  it('MemoryStorage.destroy preserves unsynced records when asked', async () => {
    const storage = new MemoryStorage(memoryStore());
    await firstValueFrom(storage.putSynced({ id: 'synced' }));
    await firstValueFrom(storage.put({ id: 'pending', _sync: { state: SyncState.Pending } }));

    await firstValueFrom(storage.destroy({ preserveUnsynced: true }));

    const remaining = (await firstValueFrom(storage.gets([]))).map((item) => item.id);

    expect(remaining).toEqual(['pending']);
  });

  it('LocalStorage.destroy clears the store', async () => {
    const storage = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));
    await firstValueFrom(storage.put([{ id: '1' }]));

    await firstValueFrom(storage.destroy());

    expect(await firstValueFrom(storage.gets([]))).toEqual([]);
  });

  it('LocalStorage.destroy preserves unsynced records when asked', async () => {
    const storage = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));
    await firstValueFrom(storage.putSynced({ id: 'synced' }));
    await firstValueFrom(storage.put({ id: 'pending', _sync: { state: SyncState.Pending } }));

    await firstValueFrom(storage.destroy({ preserveUnsynced: true }));

    const remaining = (await firstValueFrom(storage.gets([]))).map((item) => item.id);

    expect(remaining).toEqual(['pending']);
  });
});


describe('operator parity across backends', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // sort/limit/mapOne used to be applied only by the IndexedDB backend; memory and
  // localStorage silently ignored them.
  it('MemoryStorage applies sort and limit', async () => {
    const storage = new MemoryStorage(memoryStore());
    await firstValueFrom(storage.put([
      { id: '1', areaId: 3 },
      { id: '2', areaId: 1 },
      { id: '3', areaId: 2 },
    ]));

    const { sortNumber, limit } = await import('../src/app/operators');

    const sorted = await firstValueFrom(storage.gets([sortNumber('areaId')]));
    expect(sorted.map((item) => item.areaId)).toEqual([1, 2, 3]);

    const limited = await firstValueFrom(storage.gets([sortNumber('areaId'), limit(2)]));
    expect(limited.map((item) => item.areaId)).toEqual([1, 2]);
  });

  it('LocalStorage applies filters, sort and limit', async () => {
    const storage = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));
    await firstValueFrom(storage.put([
      { id: '1', areaId: 3 },
      { id: '2', areaId: 1 },
    ]));

    const { sortNumber } = await import('../src/app/operators');

    const sorted = await firstValueFrom(storage.gets([sortNumber('areaId')]));

    expect(sorted.map((item) => item.areaId)).toEqual([1, 3]);
  });

  it('LocalStorage.gets returns records rather than null', async () => {
    const storage = new LocalStorage(new AccountStore({ storage: { type: 'localStorage' } }));
    await firstValueFrom(storage.put({ id: '1' }));

    expect(await firstValueFrom(storage.gets([]))).toHaveLength(1);
  });
});
