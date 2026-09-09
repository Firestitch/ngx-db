import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { Store } from '../src/app/classes/store';
import { SyncState } from '../src/app/enums';
import { isSynced } from '../src/app/helpers';
import { filter } from '../src/app/operators';


// Mirrors the Hallmark service app: reference stores hold only downloaded data,
// queue stores may hold work the server has not accepted yet. The issue store is
// mixed, which is why the decision is per record rather than per store.
class UnitStore extends Store<any> {
  public static storeName = 'unit';
  public static keyName = 'id';
}

class IssueStore extends Store<any> {
  public static storeName = 'issue';
  public static keyName = 'guid';
}

class ServiceLogStore extends Store<any> {
  public static storeName = 'serviceLog';
  public static keyName = 'guid';
}


describe('Hallmark clearDb retention', () => {
  let units: Store<any>;
  let issues: Store<any>;
  let serviceLogs: Store<any>;

  const clearDb = async () => {
    await firstValueFrom(units.clear());
    await firstValueFrom(issues.delete(filter((record) => isSynced(record))));
    await firstValueFrom(serviceLogs.delete(filter((record) => isSynced(record))));
  };

  beforeEach(async () => {
    (globalThis as any).indexedDB = new IDBFactory();
    units = new UnitStore({});
    issues = new IssueStore({});
    serviceLogs = new ServiceLogStore({});

    await firstValueFrom(units.init());
    await firstValueFrom(issues.init());
    await firstValueFrom(serviceLogs.init());
  });

  afterEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('drops all reference data', async () => {
    await firstValueFrom(units.storage.putSynced({ id: 1, name: 'Unit 1' }));
    await firstValueFrom(units.storage.putSynced({ id: 2, name: 'Unit 2' }));

    await clearDb();

    expect(await firstValueFrom(units.gets())).toEqual([]);
  });

  // The bug this whole task exists for: a scan queued offline must survive the
  // sign in that the first scan itself triggers.
  it('keeps a queued service log through sign in', async () => {
    await firstValueFrom(serviceLogs.storage.put({
      guid: 'scan-1',
      _sync: { state: SyncState.Pending },
    }));

    await clearDb();

    const remaining = await firstValueFrom(serviceLogs.gets());

    expect(remaining.map((r) => r.guid)).toEqual(['scan-1']);
  });

  // The issue store is mixed: downloaded issues go, locally reported ones stay.
  it('keeps unsent issues while dropping downloaded ones', async () => {
    await firstValueFrom(issues.storage.putSynced({ guid: 'downloaded', id: 500 }));
    await firstValueFrom(issues.storage.put({
      guid: 'reported',
      _sync: { state: SyncState.Pending },
    }));

    await clearDb();

    const remaining = await firstValueFrom(issues.gets());

    expect(remaining.map((r) => r.guid)).toEqual(['reported']);
  });

  // A record downloaded from the server carries no _sync at all. It must be
  // treated as reference data, or the previous account's issues leak across a
  // sign in as a different account.
  it('drops a record that has no sync state at all', async () => {
    await firstValueFrom(issues.storage.put({ guid: 'from-server', id: 900 }));
    // Written straight to storage, so it has no _sync stamped.
    const before = await firstValueFrom(issues.gets());
    expect(before[0]._sync).toBeUndefined();

    await clearDb();

    expect(await firstValueFrom(issues.gets())).toEqual([]);
  });

  // Errored and processing records are unsent work too. Deleting them would
  // lose data that exists nowhere else.
  it('keeps errored and processing records', async () => {
    await firstValueFrom(issues.storage.put({
      guid: 'errored',
      _sync: { state: SyncState.Error },
    }));
    await firstValueFrom(issues.storage.put({
      guid: 'processing',
      _sync: { state: SyncState.Processing },
    }));

    await clearDb();

    const remaining = (await firstValueFrom(issues.gets()))
      .map((r) => r.guid)
      .sort();

    expect(remaining).toEqual(['errored', 'processing']);
  });

  // Object stores must survive so the init() after sign in is a no-op. This is
  // the difference between clearing and destroying.
  it('leaves every object store in place', async () => {
    await firstValueFrom(units.storage.putSynced({ id: 1 }));

    await clearDb();

    const describe: any = await firstValueFrom((units.storage as any)._indexDB.describe);

    expect(describe.objectStoreNames).toContain('unit');
    expect(describe.objectStoreNames).toContain('issue');
    expect(describe.objectStoreNames).toContain('serviceLog');
  });

  // A kept record must still sync afterwards.
  it('a kept record still syncs after the clear', async () => {
    const posted: any[] = [];
    const store = new ServiceLogStore({
      remote: { post: (data) => { posted.push(data); return of(data); } },
    });
    await firstValueFrom(store.init());
    await firstValueFrom(store.storage.put({
      guid: 'scan-1',
      _sync: { state: SyncState.Pending },
    }));

    await firstValueFrom(store.delete(filter((record) => isSynced(record))));
    await firstValueFrom(store.syncSave());

    expect(posted.map((p) => p.guid)).toEqual(['scan-1']);

    const [item] = await firstValueFrom(store.gets());
    expect(item._sync.state).toBe(SyncState.Synced);
  });
});
