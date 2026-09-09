import { firstValueFrom, of, throwError } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Store } from '../src/app/classes/store';
import { FsDb } from '../src/app/services/db.service';
import { SyncState } from '../src/app/enums';


class AccountStore extends Store<any> {
  public static storeName = 'account';
  public static keyName = 'id';
}

class BuildingStore extends Store<any> {
  public static storeName = 'building';
  public static keyName = 'id';
}

class NamelessStore extends Store<any> {
  public static keyName = 'id';
}

class KeylessStore extends Store<any> {
  public static storeName = 'keyless';
}

function memConfig(extra: any = {}): any {
  return { storage: { type: 'memory' }, ...extra };
}


describe('FsDb registration', () => {
  let db: FsDb;

  beforeEach(() => {
    db = new FsDb();
  });

  it('registers and retrieves a store by class', () => {
    const store = new AccountStore(memConfig());
    db.register(store);

    expect(db.store(AccountStore)).toBe(store);
  });

  it('retrieves a store by name', () => {
    const store = new AccountStore(memConfig());
    db.register(store);

    expect(db.store('account')).toBe(store);
  });

  it('returns undefined for an unregistered store', () => {
    expect(db.store('nope')).toBeUndefined();
  });

  it('register is chainable', () => {
    expect(db.register(new AccountStore(memConfig()))).toBe(db);
  });

  it('exposes all registered stores', () => {
    db.register(new AccountStore(memConfig()))
      .register(new BuildingStore(memConfig()));

    expect(db.stores.length).toBe(2);
  });

  it('throws when the store has no storeName', () => {
    expect(() => db.register(new NamelessStore(memConfig()))).toThrow(/storeName/);
  });

  it('throws when the store has no keyName', () => {
    expect(() => db.register(new KeylessStore(memConfig()))).toThrow(/storeKey/);
  });
});


describe('FsDb init / ready', () => {
  it('init resolves and marks ready', async () => {
    const db = new FsDb();
    db.register(new AccountStore(memConfig()));

    await firstValueFrom(db.init());

    // Subscribing *after* init must still resolve: _ready$ has completed by then,
    // so ready$ falls back to of(true).
    expect(await firstValueFrom(db.ready$)).toBe(true);
  });

  it('ready$ emits to subscribers waiting before init', async () => {
    const db = new FsDb();
    db.register(new AccountStore(memConfig()));

    // ready$ is a completion signal, so the emitted value itself is irrelevant;
    // what matters is that it resolves rather than hanging.
    let resolved = false;
    const ready = firstValueFrom(db.ready$.pipe(take(1))).then(() => { resolved = true; });

    await firstValueFrom(db.init());
    await ready;

    expect(resolved).toBe(true);
  });
});


describe('FsDb clear / destroy', () => {
  it('clear empties every store', async () => {
    const db = new FsDb();
    const accounts = new AccountStore(memConfig());
    const buildings = new BuildingStore(memConfig());
    db.register(accounts).register(buildings);

    await firstValueFrom(accounts.put({ id: '1' }));
    await firstValueFrom(buildings.put({ id: 'b1' }));

    await firstValueFrom(db.clear().pipe(toArray()));

    expect(await firstValueFrom(accounts.gets())).toEqual([]);
    expect(await firstValueFrom(buildings.gets())).toEqual([]);
  });

  it('destroy tears down every store', async () => {
    const db = new FsDb();
    const accounts = new AccountStore(memConfig());
    db.register(accounts);

    const destroy = vi.spyOn(accounts, 'destroy');

    await firstValueFrom(db.destroy());

    expect(destroy).toHaveBeenCalled();
  });
});


describe('FsDb sync', () => {
  it('sync pulls remote data into each store', async () => {
    const db = new FsDb();
    const accounts = new AccountStore(memConfig({
      remote: { gets: () => of([{ id: '1', country: 'Canada' }]) },
    }));
    db.register(accounts);

    await firstValueFrom(db.sync());

    expect((await firstValueFrom(accounts.gets())).length).toBe(1);
  });

  // Regression: startSync used observer.error() with no argument, so subscribers
  // received `undefined` and any UI surfaced a blank error.
  it('startSync propagates the real error, never undefined', async () => {
    const db = new FsDb();
    db.register(new AccountStore(memConfig({
      remote: {
        gets: () => throwError(() => new Error('remote exploded')),
      },
    })));

    // syncGet swallows remote read failures, so force the failure through sync().
    vi.spyOn(db, 'sync').mockReturnValue(throwError(() => new Error('remote exploded')));

    await expect(firstValueFrom(db.startSync(1))).rejects.toThrow('remote exploded');
  });

  it('startSync emits once on a successful sync', async () => {
    const db = new FsDb();
    db.register(new AccountStore(memConfig({ remote: { gets: () => of([]) } })));

    // startSync is Observable<void>: it signals completion of the first round,
    // so the emitted value itself is intentionally undefined.
    await expect(firstValueFrom(db.startSync(60))).resolves.toBeUndefined();
  });

  // Regression: completing the returned Observable used to run a teardown that
  // unsubscribed the polling timer, so sync ran exactly once and the whole
  // background-sync feature was silently dead. This test must be able to tell a
  // live poller from a dead one, so it asserts rounds actually accumulate.
  it('keeps polling after the first round completes', async () => {
    vi.useFakeTimers();

    try {
      const db = new FsDb();
      const gets = vi.fn(() => of([]));
      db.register(new AccountStore(memConfig({ remote: { gets } })));

      db.startSync(1).subscribe({ error: () => undefined });

      await vi.advanceTimersByTimeAsync(0);
      expect(gets.mock.calls.length).toBe(1);

      await vi.advanceTimersByTimeAsync(5000);

      // ~6 rounds at a 1s interval; assert growth rather than an exact count.
      expect(gets.mock.calls.length).toBeGreaterThan(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps polling after a round fails', async () => {
    vi.useFakeTimers();

    try {
      const db = new FsDb();
      let calls = 0;
      const gets = vi.fn(() => {
        calls++;

        return calls === 1 ? throwError(() => new Error('boom')) : of([]);
      });
      db.register(new AccountStore(memConfig({ remote: { put: () => of(null), gets } })));

      db.startSync(1).subscribe({ error: () => undefined });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(5000);

      // A failed first round must not kill the loop.
      expect(gets.mock.calls.length).toBeGreaterThan(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stopSync halts polling', async () => {
    vi.useFakeTimers();

    try {
      const db = new FsDb();
      const gets = vi.fn(() => of([]));
      db.register(new AccountStore(memConfig({ remote: { gets } })));

      db.startSync(1).subscribe({ error: () => undefined });

      // Let the loop run several rounds first, so this cannot pass vacuously
      // against an already-dead timer.
      await vi.advanceTimersByTimeAsync(3000);
      const whileRunning = gets.mock.calls.length;
      expect(whileRunning).toBeGreaterThan(1);

      db.stopSync();
      await vi.advanceTimersByTimeAsync(5000);

      expect(gets.mock.calls.length).toBe(whileRunning);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stopSync before startSync does not throw', () => {
    expect(() => new FsDb().stopSync()).not.toThrow();
  });

  it('stopSync can be called repeatedly', () => {
    const db = new FsDb();
    db.stopSync();

    expect(() => db.stopSync()).not.toThrow();
  });
});
