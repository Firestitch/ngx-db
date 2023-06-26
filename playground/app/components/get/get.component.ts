import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
} from '@angular/core';

import {
  FsDb, RemoteConfig, eq, first, limit, mapMany, mapOne, match, or, sort,
} from '@firestitch/db';
import { FsMessage } from '@firestitch/message';
import { guid } from '@firestitch/common';

import { Subject, merge, of, throwError } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { BuildingStore, AccountStore, FileStore } from 'playground/app/stores';
import { AccountData, BuildingData } from 'playground/app/data';


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
          { name: 'name', keyName: 'name' },
          //{ name: 'billingAddressId', type: 'date', },
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
      // .pipe(
      //   switchMap(() => {
      //     return this._db.startSync(5);
      //   }),
      // )
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

  public getsBilly(): void {
    this._db.store(AccountStore)
      .gets(
        eq('firstName', 'Billy'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getsTimBig(): void {
    this._db.store(AccountStore)
      .gets(
        or(
          match('name', /Tim/),
          match('name', /Big/),
        ),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortName(): void {
    this._db.store(AccountStore)
      .gets(
        sort('name'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortBillingAddressId(): void {
    this._db.store(AccountStore)
      .gets(
        sort('billingAddressId', 'numeric'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getSortModifyDate(): void {
    this._db.store(AccountStore)
      .gets(
        //sort('name'),
        sort('modifyDate','date', 'asc', { nulls: 'last' }),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public count(): void {
    this._db.store(AccountStore)
      .count(
        eq('firstName', 'Billy'),
      )
      .subscribe((values)=> {
        this.setValues(values);
      });
  }

  public getsMatch(): void {
    this._db.store(AccountStore)
      .gets(
        match('firstName', 'b', 'i'),
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

  public putSusan(): void {
    this._db.store(AccountStore)
      .get('10')
      .pipe(
        switchMap((data) => {
          return data === undefined ? throwError('Failed to find account') : of(data);
        }),
        switchMap((data) => {
          data = {
            ...data,
            firstName: 'Susan Changed',
            lastName: 'Wilson Changed',
          };

          return this._db.store(AccountStore)
            .put(data);
        }),
      )
      .subscribe((response)=> {
        this._message.success('Saved');
      });
  }

  public post(): void {
    this._db.store(AccountStore)
      .put({
        id: String(Math.floor(Math.random() * 100000)),
        firstName: 'Luke',
        lastName: 'Skywalker',
        buildingId: 1,
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

  public deleteFirst(): void {
    this._db.store(AccountStore)
      .delete(
        first(),
      )
      .subscribe(()=> {
        this._message.success('Deleted last');
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

  public getsLimit(): void {
    this._db.store(AccountStore)
      .gets(
        limit(2, 2),
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
