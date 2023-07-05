import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import {
  FsDb, RemoteConfig, eq, limit, mapMany, mapOne, match, or, sort, sortDate, sortNumber,
} from '@firestitch/db';
import { FsMessage } from '@firestitch/message';
import { guid } from '@firestitch/common';

import { Subject, merge, of, throwError } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { BuildingStore, AccountStore, FileStore } from 'playground/app/stores';
import { AccountData, BuildingData } from 'playground/app/data';

import { ConsoleComponent } from '../console';


@Component({
  selector: 'app-get',
  templateUrl: './get.component.html',
  styleUrls: ['./get.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetComponent implements OnInit, OnDestroy {

  public id = '1';
  public values;

  private _destroy$ = new Subject();

  constructor(
    private _db: FsDb,
    private _message: FsMessage,
    private _dialog: MatDialog,
    private _cdRef: ChangeDetectorRef,
  ) {
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

    const buildingRemote: RemoteConfig = {
      gets: (query) => of(BuildingData),
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
      .register(new BuildingStore({ remote: buildingRemote }))
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
      .subscribe(() => {
        this._message.info('Ready!');
      });
  }

  public ngOnInit(): void {
    this._db.ready$
      .pipe(
        switchMap(() =>
          merge(
            this._db.store(AccountStore).changes$
              .pipe(
                switchMap(() => this._db.store(AccountStore).gets()),
              ),
            this._db.store(AccountStore).gets(),
          ),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe((values) => {
        this.setValues(values);
      });
  }

  public getsIndonesia(): void {
    this._db.store(AccountStore)
      .gets(
        eq('country', 'Indonesia'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getsMatchOr(): void {
    this._db.store(AccountStore)
      .gets(
        or(
          match('country', /Canada/),
          eq('areaId', 3),
        ),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortName(): void {
    this._db.store(AccountStore)
      .gets(
        sort('country'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortAreaId(): void {
    this._db.store(AccountStore)
      .gets(
        sortNumber('areaId'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortDate(): void {
    this._db.store(AccountStore)
      .gets(
        sortDate('date', 'asc', { nulls: 'last' }),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public count(): void {
    this._db.store(AccountStore)
      .count(
        eq('areaId', 2),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getsMatchCase(): void {
    this._db.store(AccountStore)
      .gets(
        match('country', 'sweden', 'i'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getId(): void {
    this._db.store(AccountStore)
      .get(this.id)
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public put(data): void {
    this._db.store(AccountStore)
      .put(data)
      .subscribe((response)=> {
        this._message.success('Saved');
      });
  }

  public putIndia(): void {
    this._db.store(AccountStore)
      .get('1')
      .pipe(
        switchMap((data) => {
          return data === undefined ? throwError('Failed to find') : of(data);
        }),
        switchMap((data) => {
          data = {
            ...data,
            name: 'India Updated',
            areaId: 20,
            date: new Date(),
          };

          return this._db.store(AccountStore)
            .put(data);
        }),
      )
      .subscribe(()=> {
        this._message.success('Saved');
      });
  }

  public post(): void {
    this._db.store(AccountStore)
      .put({
        id: String(Math.floor(Math.random() * 100000)),
        country: 'Italy',
        date: new Date(),
        areaId: 55,
      })
      .subscribe(()=> {
        this._message.success('Saved');
      });
  }

  public filePost(): void {
    this._db.store(FileStore)
      .put({
        guid: guid(),
        file: new File([], 'filename.jpg'),
      })
      .subscribe(()=> {
        this._message.success('Saved');
      });
  }

  public deleteAll(): void {
    this._db.store(AccountStore)
      .clear()
      .subscribe(()=> {
        this._message.success('Deleted All');
      });
  }

  public clear(): void {
    this._db.clear()
      .subscribe(()=> {
        this._message.success('Cleared');
      });
  }

  public destroy(): void {
    this._db.destroy()
      .subscribe(()=> {
        this._message.success('Destroyed');
      });
  }

  public startSync(): void {
    this._db.startSync(5)
      .subscribe(() => {
        this._message.success('Started Sync');
      });
  }

  public stopSync(): void {
    this._db.stopSync();
    this._message.success('Stopped Sync');
  }

  public getKeys(): void {
    this._db.store(AccountStore)
      .keys()
      .subscribe((values)=> {
        this.setValues(values);
        this._message.success();
      });
  }

  public openConsole(): void {
    this._dialog.open(ConsoleComponent);
  }

  public gets(): void {
    this._db.store(AccountStore)
      .gets(
        mapOne(this._db.store(BuildingStore), 'building', 'buildingId', 'id'),
        mapMany(this._db.store(BuildingStore), 'buildings', 'id', 'buildingId'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getsLimit(count, offset): void {
    this._db.store(AccountStore)
      .gets(
        sortDate('date'),
        limit(count, offset),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public setValues(values): void {
    this.values = values;
    this._cdRef.markForCheck();
  }
}
