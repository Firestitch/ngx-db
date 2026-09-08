import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';

import {
  FsDb, RemoteConfig, eq, limit, mapMany, mapOne, match, or, sort, sortDate, sortNumber,
} from '@firestitch/db';
import { FsMessage } from '@firestitch/message';
import { guid } from '@firestitch/common';

import { Subject, merge, of, throwError } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { RegionStore, AccountStore, FileStore } from 'playground/app/stores';
import { AccountData, RegionData } from 'playground/app/data';

import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';


interface Action {
  name: string;
  run: () => void;
}

interface ActionGroup {
  name: string;
  actions: Action[];
}


@Component({
    selector: 'app-get',
    templateUrl: './get.component.html',
    styleUrls: ['./get.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButton, JsonPipe],
})
export class GetComponent implements OnInit, OnDestroy {
  private _db = inject(FsDb);
  private _message = inject(FsMessage);
  private _cdRef = inject(ChangeDetectorRef);


  public id = '1';
  public values;
  public error: string = null;
  public lastAction: string = null;
  public duration: number = null;
  public resultCount: number = null;
  public raw = false;
  public autoSync = false;
  public rows: any[] = [];
  public columns: string[] = [];

  public actionGroups: ActionGroup[] = [
    {
      name: 'Find',
      actions: [
        { name: 'All', run: () => this.gets() },
        { name: 'Just the IDs', run: () => this.getKeys() },
        { name: 'Indonesia', run: () => this.getsIndonesia() },
        { name: 'Sweden', run: () => this.getsMatchCase() },
        { name: 'Canada or in Asia', run: () => this.getsMatchOr() },
      ],
    },
    {
      name: 'Sort',
      actions: [
        { name: 'By country', run: () => this.getSortName() },
        { name: 'By population', run: () => this.getSortPopulation() },
        { name: 'By date', run: () => this.getSortDate() },
      ],
    },
    {
      name: 'Page',
      actions: [
        { name: 'First 2', run: () => this.getsLimit(2, 0) },
        { name: 'Next 2', run: () => this.getsLimit(2, 2) },
        { name: 'Count in Asia', run: () => this.count() },
      ],
    },
    {
      name: 'Change',
      actions: [
        {
          name: 'Add one',
          run: () => this.put({ id: 1000, country: 'India', regionId: 2, population: 1417, date: null }),
        },
        { name: 'Edit one', run: () => this.putIndia() },
        { name: 'Add random', run: () => this.post() },
        { name: 'Add file', run: () => this.filePost() },
      ],
    },
    {
      name: 'Sync',
      actions: [
        { name: 'Sync now', run: () => this.syncOnce() },
      ],
    },
    {
      name: 'Start over',
      actions: [
        { name: 'Delete all data', run: () => this.clear() },
        { name: 'Reload demo data', run: () => this.reseed() },
      ],
    },
  ];

  private _destroy$ = new Subject();
  private _started: number = null;

  constructor() {
    const accountRemote: RemoteConfig = {
      gets: ({ limit, offset }) =>
        of(AccountData)
          .pipe(
            map((data) => {
              return [...data].slice(offset, offset + limit);
            }),
            tap((_data) => {
              console.log('Remote Gets', limit, offset);
            }),
          ),
      put: (data) => of(data)
        .pipe(
          switchMap((item) => {
            // A regionId of 999 is rejected on purpose so the error sync state is
            // demonstrable; everything else saves normally.
            return item.regionId === 999
              ? throwError(() => new Error('Server rejected this record'))
              : of(item);
          }),
          tap((_data) => {
            console.log('Remote Put', _data);
          }),
        ),
      post: (data) => of(data)
        .pipe(
          tap((_data) => {
            console.log('Remote Post', _data);
          }),
        ),
    };

    const regionRemote: RemoteConfig = {
      gets: () => of(RegionData),
      put: (data) => of(data)
        .pipe(
          tap((_data) => {
            console.log('Remote Put', _data);
          }),
        ),
      post: (data) => of(data)
        .pipe(
          tap((_data) => {
            console.log('Remote Post', _data);
          }),
        ),
    };

    this._db
      .register(new AccountStore({
        remote: accountRemote,
        indexes: [
          { name: 'country', keyName: 'country' },
          { name: 'date', keyName: 'date' },
        ],
      }))
      .register(new RegionStore({ remote: regionRemote }))
      .register(new FileStore({
        remote: {
          post: (data) => of(data)
            .pipe(
              tap((_data) => {
                console.log('Remote Post', _data);
              }),
            ),
        },
        storage: {
          type: 'memory',
        },
      }))
      .init()
      .pipe(
        // Pull the seed data on load so the demo always opens with rows to play
        // with, instead of an empty store that makes every filter look broken.
        switchMap(() => this._db.sync()),
      )
      .subscribe({
        next: () => {
          this._message.info('Loaded demo countries');
          this.lastAction = 'All';
          this.refresh();
        },
        error: (error) => {
          this._message.error(String(error?.message ?? error));
          this.setError(error);
        },
      });
  }

  public ngOnInit(): void {
    // The initial render is driven by the seed load in the constructor. This only
    // keeps the panel live when a background sync changes the data underneath it.
    this._db.ready$
      .pipe(
        switchMap(() => this._db.store(AccountStore).changes$),
        switchMap(() => this._db.store(AccountStore)
          .gets(
            mapOne(this._db.store(RegionStore), 'region', 'regionId', 'id'),
          ),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: () => undefined,
      });
  }

  public getsIndonesia(): void {
    this._db.store(AccountStore)
      .gets(
        eq('country', 'Indonesia'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getsMatchOr(): void {
    this._db.store(AccountStore)
      .gets(
        or(
          match('country', /Canada/),
          eq('regionId', 3),
        ),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getSortName(): void {
    this._db.store(AccountStore)
      .gets(
        sort('country'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getSortPopulation(): void {
    this._db.store(AccountStore)
      .gets(
        sortNumber('population'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getSortDate(): void {
    this._db.store(AccountStore)
      .gets(
        sortDate('date', 'asc', { nulls: 'last' }),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public count(): void {
    this._db.store(AccountStore)
      .count(
        eq('regionId', 2),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getsMatchCase(): void {
    this._db.store(AccountStore)
      .gets(
        match('country', 'sweden', 'i'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getId(): void {
    this._db.store(AccountStore)
      .get(this.id)
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public put(data): void {
    this._db.store(AccountStore)
      .put(data)
      .subscribe({
        next: () => {
          this.setValues(data);
          this._message.success('Saved');
        },
        error: (error) => this.setError(error),
      });
  }

  public putIndia(): void {
    // Edit the first record in the store, whatever it is, and show the result so
    // the bumped revision is visible.
    this._db.store(AccountStore)
      .gets(limit(1))
      .pipe(
        switchMap((data) => {
          if (!data.length) {
            return throwError(() => new Error('No records — click "Reload demo data" first'));
          }

          return this._db.store(AccountStore)
            .put({
              ...data[0],
              country: `${data[0].country} (edited)`,
              date: new Date(),
            });
        }),
        switchMap(() => this._db.store(AccountStore).gets(limit(1))),
      )
      .subscribe({
        next: (values) => {
          this._message.success('Edited the first record');
          this.setValues(values);
        },
        error: (error) => this.setError(error),
      });
  }

  public post(): void {
    this._db.store(AccountStore)
      .put({
        id: String(Math.floor(Math.random() * 100000)),
        country: 'Italy',
        regionId: 1,
        population: 59,
        date: new Date(),
      })
      .pipe(
        switchMap(() => this._db.store(AccountStore).gets()),
      )
      .subscribe({
        next: (values) => {
          this._message.success('Added a random country');
          this.setValues(values);
        },
        error: (error) => this.setError(error),
      });
  }

  public filePost(): void {
    this._db.store(FileStore)
      .put({
        guid: guid(),
        file: new File([], 'filename.jpg'),
      })
      .pipe(
        switchMap(() => this._db.store(FileStore).gets()),
      )
      .subscribe({
        next: (values) => {
          this._message.success('Added a file (memory store)');
          this.setValues(values);
        },
        error: (error) => this.setError(error),
      });
  }


  public clear(): void {
    // Stop auto sync first, otherwise the next poll pulls everything straight back
    // from the server and the delete looks like it silently failed.
    this._db.stopSync();
    this.autoSync = false;

    this._db.clear()
      .subscribe({
        next: () => {
          this._message.success('Deleted everything (auto sync turned off)');
          this.setValues([]);
        },
        error: (error) => this.setError(error),
      });
  }



  public syncOnce(): void {
    this._db.sync()
      .pipe(
        switchMap(() => this._db.store(AccountStore).gets()),
      )
      .subscribe({
        next: (values) => {
          this._message.success('Sync complete');
          this.setValues(values);
        },
        error: (error) => this.setError(error),
      });
  }

  public reseed(): void {
    // Push the seed data straight into storage as already-synced server records,
    // so the demo can be returned to a known state at any time.
    this._db.store(AccountStore)
      .clear()
      .pipe(
        switchMap(() => this._db.store(AccountStore).syncGet()),
        switchMap(() => this._db.store(RegionStore).syncGet()),
        switchMap(() => this._db.store(AccountStore).gets()),
      )
      .subscribe({
        next: (values) => {
          this._message.success('Demo data reloaded');
          this.setValues(values);
        },
        error: (error) => this.setError(error),
      });
  }

  public toggleAutoSync(): void {
    if (this.autoSync) {
      this._db.stopSync();
      this.autoSync = false;
      this._message.success('Auto sync off');

      return;
    }

    this.autoSync = true;
    this._message.success('Auto sync on — re-checking the server every 5s');

    this._db.startSync(5)
      .subscribe({
        next: () => this.refresh(),
        error: (error) => this.setError(error),
      });
  }

  // Re-read the countries so the panel always shows current data instead of
  // being blanked out by an action that has nothing of its own to display.
  public refresh(): void {
    this._db.store(AccountStore)
      .gets(
        mapOne(this._db.store(RegionStore), 'region', 'regionId', 'id'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getKeys(): void {
    this._db.store(AccountStore)
      .keys()
      .subscribe({
        next: (values) => {
          this.setValues(values);
          this._message.success();
        },
        error: (error) => this.setError(error),
      });
  }


  public gets(): void {
    this._db.store(AccountStore)
      .gets(
        mapOne(this._db.store(RegionStore), 'region', 'regionId', 'id'),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public getsLimit(count, offset): void {
    this._db.store(AccountStore)
      .gets(
        sortDate('date'),
        limit(count, offset),
      )
      .subscribe({
        next: (values) => this.setValues(values),
        error: (error) => this.setError(error),
      });
  }

  public ngOnDestroy(): void {
    // Leaving the page must not leave a sync timer running.
    this._db.stopSync();
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  public run(action: Action): void {
    this.lastAction = action.name;
    this.error = null;
    this.duration = null;
    this._started = performance.now();
    this._cdRef.markForCheck();

    try {
      action.run();
    } catch (error) {
      this.setError(error);
    }
  }

  public setValues(values): void {
    this.values = values;
    this.resultCount = Array.isArray(values) ? values.length : null;

    // Only object rows render as a table; scalars (keys, counts) fall back to raw.
    this.rows = Array.isArray(values) && values.every((v) => v && typeof v === 'object')
      ? values
      : [];

    this.columns = this.rows.length
      ? Object.keys(this.rows[0]).filter((key) => key !== '_sync')
      : [];

    this._stop();
  }

  // Flatten a cell for display: mapped objects (region) show their name, dates show
  // as a short date, everything else prints as-is.
  public cell(row: any, column: string): string {
    const value = row[column];

    if (value === null || value === undefined) {
      return '—';
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'object') {
      return value.name ?? JSON.stringify(value);
    }

    if (column === 'date' && typeof value === 'string') {
      return value.slice(0, 10);
    }

    return String(value);
  }

  public setError(error): void {
    this.error = error instanceof Error
      ? error.message
      : (error?.message ?? String(error));
    this.resultCount = null;
    this._stop();
    this._message.error(this.error);
  }

  private _stop(): void {
    if(this._started !== null) {
      this.duration = Math.round(performance.now() - this._started);
      this._started = null;
    }

    this._cdRef.markForCheck();
  }
}
