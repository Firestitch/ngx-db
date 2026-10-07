import { NEVER, Subject, firstValueFrom, of, throwError, timer, toArray } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Store } from '../src/app/classes/store';
import { SyncState } from '../src/app/enums';
import { eq, sortNumber } from '../src/app/operators';


class AccountStore extends Store<any> {
  public static storeName = 'account';
  public static keyName = 'id';
}

class BuildingStore extends Store<any> {
  public static storeName = 'building';
  public static keyName = 'id';
}

function memStore(config: any = {}): Store<any> {
  return new AccountStore({ storage: { type: 'memory' }, ...config });
}


describe('Store basics', () => {
  it('exposes storeName and keyName from statics', () => {
    const store = memStore();

    expect(store.name).toBe('account');
    expect(store.keyName).toBe('id');
  });

  it('defaults to indexDb storage when none is configured', () => {
    expect(new AccountStore({}).config.storage.type).toBe('indexDb');
  });

  it('counts records matching operators', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1', areaId: 2 }, { id: '2', areaId: 3 }]));

    expect(await firstValueFrom(store.count(eq('areaId', 2)))).toBe(1);
    expect(await firstValueFrom(store.count())).toBe(2);
  });

  it('returns keys', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1' }, { id: '2' }]));

    expect((await firstValueFrom(store.keys())).sort()).toEqual(['1', '2']);
  });

  it('sorts via operators', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1', areaId: 3 }, { id: '2', areaId: 1 }]));

    const data = await firstValueFrom(store.gets(sortNumber('areaId')));

    expect(data.map((item) => item.areaId)).toEqual([1, 3]);
  });
});


describe('Store.put', () => {
  it('stamps Pending sync state and revision 0 for a new record', async () => {
    const store = memStore();
    await firstValueFrom(store.put({ id: '1' }));

    const item = await firstValueFrom(store.get('1'));

    expect(item._sync.state).toBe(SyncState.Pending);
    expect(item._sync.revision).toBe(0);
  });

  it('carries the existing revision forward on update', async () => {
    const store = memStore();

    await firstValueFrom(store.storage.putSynced({ id: '1' }));
    expect((await firstValueFrom(store.get('1')))._sync.revision).toBe(1);

    await firstValueFrom(store.put({ id: '1', country: 'Canada' }));
    const item = await firstValueFrom(store.get('1'));

    expect(item._sync.revision).toBe(1);
    expect(item.country).toBe('Canada');
  });

  it('puts many records', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1' }, { id: '2' }, { id: '3' }]));

    expect((await firstValueFrom(store.gets())).length).toBe(3);
  });

  it('emits a put change event', async () => {
    const store = memStore();
    const changes = firstValueFrom(store.changes$.pipe(take(1)));

    await firstValueFrom(store.put({ id: '1' }));

    expect((await changes).type).toBe('put');
  });
});


// put() used to send first and write locally only once the server had answered,
// so a record whose send failed was stored nowhere. navigator.onLine cannot tell
// a network with no internet behind it from a working one, which is exactly when
// that happens (HM-T4827).
describe('Store.put with a remote', () => {
  const noAnswer = { status: 0 };
  const serverFault = { status: 503 };
  const refusal = { status: 422 };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the record locally before it is sent', async () => {
    let storedWhenSent: any;
    const store = memStore({
      remote: {
        post: (data) => store.get('1')
          .pipe(
            tap((stored) => {
              storedWhenSent = stored;
            }),
            map(() => data),
          ),
      },
    });

    await firstValueFrom(store.put({ id: '1' }));

    expect(storedWhenSent?._sync.state).toBe(SyncState.Pending);
  });

  it('marks the record Synced when the server accepts it', async () => {
    const store = memStore({ remote: { post: (data) => of(data) } });

    await firstValueFrom(store.put({ id: '1' }));

    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Synced);
  });

  it.each([
    ['no answer from the server', noAnswer],
    ['a server fault', serverFault],
  ])('keeps the record pending and completes on %s', async (_name, error) => {
    const post = vi.fn(() => throwError(() => error));
    const store = memStore({ remote: { post } });

    await expect(firstValueFrom(store.put({ id: '1', country: 'Canada' }))).resolves.toBeNull();

    const item = await firstValueFrom(store.get('1'));

    expect(item.country).toBe('Canada');
    expect(item._sync.state).toBe(SyncState.Pending);
  });

  it('sends a record it could not send on the next sync', async () => {
    let online = false;
    const post = vi.fn((data) => online ? of(data) : throwError(() => noAnswer));
    const store = memStore({ remote: { post } });

    await firstValueFrom(store.put({ id: '1' }));
    online = true;
    await firstValueFrom(store.syncSave());

    expect(post).toHaveBeenCalledTimes(2);
    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Synced);
  });

  it('errors to the caller when the server refuses the record', async () => {
    const store = memStore({ remote: { post: () => throwError(() => refusal) } });

    await expect(firstValueFrom(store.put({ id: '1' }))).rejects.toBe(refusal);
  });

  it('waits for a slow send when no saveTimeout is set', async () => {
    const store = memStore({
      remote: { post: (data) => timer(30).pipe(map(() => data)) },
    });

    await firstValueFrom(store.put({ id: '1' }));

    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Synced);
  });

  it('stops waiting after saveTimeout and keeps the record pending', async () => {
    const store = memStore({ remote: { post: () => NEVER, saveTimeout: 20 } });

    await expect(firstValueFrom(store.put({ id: '1' }))).resolves.toBeNull();

    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Pending);
  });

  // save() marks a failed update as Error, which the sync never picks up again.
  // An update that merely could not be sent has to go back in as pending.
  it('keeps an update pending, not Error, when it could not be sent', async () => {
    const store = memStore({ remote: { put: () => throwError(() => noAnswer) } });

    await firstValueFrom(store.storage.putSynced({ id: '1' }));
    await firstValueFrom(store.put({ id: '1', country: 'Canada' }));

    const item = await firstValueFrom(store.get('1'));

    expect(item.country).toBe('Canada');
    expect(item._sync.state).toBe(SyncState.Pending);
    expect(item._sync.revision).toBe(1);
  });

  it('marks a refused update as Error and errors to the caller', async () => {
    const store = memStore({ remote: { put: () => throwError(() => refusal) } });

    await firstValueFrom(store.storage.putSynced({ id: '1' }));
    await expect(firstValueFrom(store.put({ id: '1' }))).rejects.toBe(refusal);

    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Error);
  });

  // The record is in storage as pending while it is being sent, so a sync round
  // that fires mid-send would otherwise send it a second time.
  it('syncSave leaves a record that put() is still sending', async () => {
    const answer = new Subject<any>();
    const post = vi.fn(() => answer.asObservable());
    const store = memStore({ remote: { post } });

    const put = firstValueFrom(store.put({ id: '1' }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    await firstValueFrom(store.syncSave());
    expect(post).toHaveBeenCalledTimes(1);

    answer.next({ id: '1' });
    answer.complete();
    await put;

    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Synced);
  });

  it('lets the consumer decide what could not be sent', async () => {
    const queued = memStore({
      remote: { post: () => throwError(() => refusal), queueOnError: () => true },
    });
    const refused = memStore({
      remote: { post: () => throwError(() => noAnswer), queueOnError: () => false },
    });

    await expect(firstValueFrom(queued.put({ id: '1' }))).resolves.toBeNull();
    await expect(firstValueFrom(refused.put({ id: '1' }))).rejects.toBe(noAnswer);
  });

  it('does not send while the device reports no connection', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const post = vi.fn((data) => of(data));
    const store = memStore({ remote: { post } });

    await firstValueFrom(store.put({ id: '1' }));

    expect(post).not.toHaveBeenCalled();
    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Pending);
  });

  it('emits one put change for a record left pending', async () => {
    const store = memStore({ remote: { post: () => throwError(() => noAnswer) } });
    const changes: string[] = [];

    store.changes$.subscribe((change) => changes.push(change.type));
    await firstValueFrom(store.put({ id: '1' }));

    expect(changes).toEqual(['put']);
  });
});


describe('Store.delete / clear', () => {
  it('deletes records matching operators', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1', areaId: 1 }, { id: '2', areaId: 2 }]));

    await firstValueFrom(store.delete(eq('areaId', 1)));

    const remaining = await firstValueFrom(store.gets());

    expect(remaining.map((item) => item.id)).toEqual(['2']);
  });

  it('delete with no operators removes everything', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1' }, { id: '2' }]));

    await firstValueFrom(store.delete());

    expect(await firstValueFrom(store.gets())).toEqual([]);
  });

  it('emits a delete change per key', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1' }, { id: '2' }]));

    const changes = firstValueFrom(store.changes$.pipe(take(2), toArray()));

    await firstValueFrom(store.delete());

    expect((await changes).map((change) => change.type)).toEqual(['delete', 'delete']);
  });

  it('clear empties the store and emits a clear change', async () => {
    const store = memStore();
    await firstValueFrom(store.put([{ id: '1' }]));

    const changes = firstValueFrom(store.changes$.pipe(take(1)));
    await firstValueFrom(store.clear());

    expect(await firstValueFrom(store.gets())).toEqual([]);
    expect((await changes).type).toBe('clear');
  });
});


describe('Store remote sync', () => {
  it('syncGet pulls remote data and marks it Synced', async () => {
    const store = memStore({
      remote: {
        gets: () => of([{ id: '1', country: 'Canada' }]),
      },
    });

    await firstValueFrom(store.syncGet());

    const item = await firstValueFrom(store.get('1'));

    expect(item.country).toBe('Canada');
    expect(item._sync.state).toBe(SyncState.Synced);
  });

  it('syncGet is a no-op when the store has no remote', async () => {
    await expect(firstValueFrom(memStore().syncGet())).resolves.toBeNull();
  });

  // Regression: the guard read `!syncState || SyncState.Synced`, which is always
  // truthy, so a remote pull overwrote records the user had edited locally.
  it('syncGet does not overwrite a locally Pending record', async () => {
    const store = memStore({
      remote: { gets: () => of([{ id: '1', country: 'FromServer' }]) },
    });

    await firstValueFrom(store.storage.put({
      id: '1',
      country: 'LocalEdit',
      _sync: { state: SyncState.Pending },
    }));

    await firstValueFrom(store.syncGet());

    const item = await firstValueFrom(store.get('1'));

    expect(item.country).toBe('LocalEdit');
    expect(item._sync.state).toBe(SyncState.Pending);
  });

  it('syncGet does overwrite an already Synced record', async () => {
    const store = memStore({
      remote: { gets: () => of([{ id: '1', country: 'FromServer' }]) },
    });

    await firstValueFrom(store.storage.putSynced({ id: '1', country: 'Stale' }));
    await firstValueFrom(store.syncGet());

    expect((await firstValueFrom(store.get('1'))).country).toBe('FromServer');
  });

  it('syncSave posts pending records and marks them Synced', async () => {
    const post = vi.fn((data) => of(data));
    const store = memStore({ remote: { post } });

    // Write directly to storage so put()'s own remote-save path is bypassed.
    await firstValueFrom(store.storage.put({ id: '1', _sync: { state: SyncState.Pending } }));

    await firstValueFrom(store.syncSave());

    expect(post).toHaveBeenCalledTimes(1);
    expect((await firstValueFrom(store.get('1')))._sync.state).toBe(SyncState.Synced);
  });

  it('syncSave marks a failed record as Error and increments retries', async () => {
    const store = memStore({ remote: { put: () => throwError(() => 'boom') } });

    await firstValueFrom(store.storage.put({
      id: '1',
      _sync: { state: SyncState.Pending, revision: 1 },
    }));

    await firstValueFrom(store.syncSave());

    const item = await firstValueFrom(store.get('1'));

    expect(item._sync.state).toBe(SyncState.Error);
    expect(item._sync.retries).toBe(1);
  });

  it('syncSave ignores records that are not Pending', async () => {
    const post = vi.fn((data) => of(data));
    const store = memStore({ remote: { post } });

    await firstValueFrom(store.storage.putSynced({ id: '1' }));
    await firstValueFrom(store.syncSave());

    expect(post).not.toHaveBeenCalled();
  });
});


describe('mapOne / mapMany operators', () => {
  it('mapOne attaches the referenced record', async () => {
    const { mapOne } = await import('../src/app/operators');

    const buildings = new BuildingStore({ storage: { type: 'memory' } });
    await firstValueFrom(buildings.put({ id: 'b1', name: 'HQ' }));

    const accounts = memStore();
    await firstValueFrom(accounts.put({ id: '1', buildingId: 'b1' }));

    const data = await firstValueFrom(
      accounts.gets(mapOne(buildings, 'building', 'buildingId', 'id')),
    );

    expect(data[0].building?.name).toBe('HQ');
  });
});
