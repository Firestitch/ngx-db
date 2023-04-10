import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
} from '@angular/core';

import { FsDb, RemoteConfig, eq, first, limit, mapMany, mapOne } from '@firestitch/db';
import { FsMessage } from '@firestitch/message';

import { Subject, merge, of } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';

import { BuildingStore, AccountStore } from 'playground/app/stores';
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
      gets: (query) =>
        of(AccountData)
          .pipe(
            tap((_data) => {
              console.log('Remote Gets', query);
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
      .register(new AccountStore({ remote: accountRemote }))
      .register(new BuildingStore({ remote: buildingRemote }))
      .init()
      .subscribe();
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
        this.values = values;
        this._cdRef.markForCheck();
      });
  }

  public getsBilly(): void {
    this._db.store(AccountStore)
      .gets(
        eq('firstName', 'Billy'),
      )
      .subscribe((data)=> {
        this._message.success(JSON.stringify(data));
      });
  }

  public getId(): void {
    this._db.store(AccountStore)
      .get(this.id)
      .subscribe((data)=> {
        console.log(data);
        this._message.success(JSON.stringify(data));
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
        id: Math.floor(Math.random() * 100000),
        firstName: 'Luke',
        lastName: 'Skywalker',
        buildingId: 1,
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

  public getKeys(): void {
    this._db.store(AccountStore)
      .keys()
      .subscribe((values)=> {
        this.values = values;
        this._cdRef.markForCheck();
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
        this.values = values;
        this._cdRef.markForCheck();
        this._message.success();
      });
  }


  public getsLimit(): void {
    this._db.store(AccountStore)
      .gets(
        limit(2, 2),
      )
      .subscribe((values)=> {
        this.values = values;
        this._cdRef.markForCheck();
        this._message.success();
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}

