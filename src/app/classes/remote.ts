import { Observable, concat, merge, of, throwError } from 'rxjs';
import { catchError, filter, finalize, map, mapTo, switchMap, tap, toArray } from 'rxjs/operators';

import { Data, RemoteConfig } from '../interfaces';
import { filter as operatorFilter } from '../operators';
import { SyncState } from '../enums';

import { Store } from './store';


export class Remote<T> {

  private _syncing = false;
  private _modifyDate: Date;
  private _limit: number;
  private _gets: (query: { limit: number; offset: number; modifyDate: Date }) => Observable<any[]>;
  private _put: (data: any) => Observable<any>;
  private _post: (data: any) => Observable<any>;

  constructor(
    private _store: Store<any>,
    private _config: RemoteConfig,
  ) {
    this._gets = this._config.gets;
    this._put = this._config.put;
    this._post = this._config.post;
    this._limit = this._config.limit || 100;
  }

  public startSync(): boolean {
    if(this._syncing || !navigator.onLine) {
      return false;
    }

    this._syncing = true;
  }

  public endSync(): void {
    this._syncing = false;
  }

  public get syncing(): boolean {
    return this._syncing;
  }

  public destroy(): void {
    this._modifyDate = null;
    this._syncing = false;
  }

  public syncGet(): Observable<void> {
    if(!this._gets || this.syncing) {
      return of(null);
    }

    this.startSync();

    return this._getAll()
      .pipe(
        this._catchError('Sync Gets Error'),
        switchMap((data: any[]) => {
          if(!data?.length) {
            return of(null);
          }

          return merge(
            ...data
              .map((item) => this._store.storage.get(item[this._store.keyName])),
          )
            .pipe(
              toArray(),
              map((stoageData) => {
                stoageData = stoageData.reduce((accum, item) => {
                  return item ? {
                    ...accum,
                    [item[this._store.keyName]]: item,
                  } : accum;
                }, {});

                return stoageData;
              }),
              switchMap((storageData: { [key: string]: any }) => {
                const remoteData = data
                  .filter((item) => {
                    const syncState = storageData[item[this._store.keyName]]?._sync?.state;

                    return syncState !== SyncState.Pending;
                  })
                  .map((item) => {
                    return this._store.storage.put(this._dataSynced(item));
                  } );

                if(remoteData.length === 0) {
                  return of(null);
                }

                return merge(
                  ...remoteData,
                )
                  .pipe(
                    toArray(),
                  );
              }),
            );
        }),
        tap(() => {
          this._modifyDate = new Date();
        }),
        mapTo(null),
        tap(() => this.endSync()),
        finalize(() => {
          this.endSync();
        }),
      );
  }

  public syncSave(): Observable<void> {
    if((!this._post && !this._put) || this.syncing) {
      return of(null);
    }

    this.startSync();

    return this._store
      .gets(
        operatorFilter((item: Data<any>) => {
          return item._sync?.state === SyncState.Pending;
        }),
      )
      .pipe(
        switchMap((data: any[]) => {
          if(!data?.length) {
            return of(null);
          }

          return concat(
            ...data.map((item: Data<any>) => {
              return this._save(item)
                .pipe(
                  this._catchError('Sync Save Error', item),
                  switchMap((response: Data<T>) => {
                    return this._store.storage.put(this._dataSynced(response));
                  }),
                  this._catchError('Sync Storage Put Error', item),
                );
            }),
          )
            .pipe(
              toArray(),
            );
        }),
        mapTo(null),
        tap(() => this.endSync()),
        finalize(() => {
          this.endSync();
        }),
      );
  }

  private _dataSynced(data: Data<T>): Data<T> {
    return {
      ...data,
      _sync: {
        state: SyncState.Synced,
        revision: 1,
        date: new Date(),
      },
    };
  }

  private _save(item: Data<unknown>): Observable<any> {
    item._sync.state = SyncState.Processing;

    if(!item._sync.revision) {
      if(!this._post) {
        return throwError('Remote post method not configured');
      }

      return this._post(item);
    }

    if(!this._put) {
      return throwError('Remote put method not configured');
    }

    return this._put(item);
  }

  private _catchError(errorType, item?) {
    if(item) {
      item._sync.state = SyncState.Error;
    }

    return catchError((error) => {
      console.error(errorType, error);

      return of(null)
        .pipe(
          filter(() => false),
        );
    });
  }

  private _getAll(): Observable<any[]> {
    return this._getPage([], 0);
  }

  private _getPage(data, offset): Observable<any[]> {
    const query = {
      modifyDate: this._modifyDate,
      limit: this._limit,
      offset,
    };

    return this._gets(query)
      .pipe(
        switchMap((pageData) => {
          data.push(...pageData);

          if(pageData.length < this._limit) {
            return of(data);
          }

          offset += this._limit;

          return this._getPage(data, offset);
        }),
      );
  }

}
