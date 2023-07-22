import { Observable, Subject, merge, of } from 'rxjs';
import { filter, map, mapTo, switchMap, tap } from 'rxjs/operators';

import { IndexDbStorage, LocalStorage, MemoryStorage, Storage } from '../storage';
import { Changes, Data, StoreConfig } from '../interfaces';
import { Operator } from '../types';
import { SyncState } from '../enums';

import { Remote } from './remote';


export abstract class Store<T> {

  public static storeName: string;
  public static keyName: string;
  public static revisionName: string;

  private _storage: Storage;
  private _remote: Remote<T>;
  private _changes$ = new Subject<Changes<T>>();

  constructor(
    private _config: StoreConfig,
  ) {
    this._config = this._config || {};
    this._storage = this.createStorage(this);

    if (_config.remote) {
      this._remote = new Remote<T>(this, _config.remote);
    }
  }

  public createStorage(store): Storage {
    this.config.storage = this.config.storage || {
      type: 'indexDb',
    };

    switch (this._config.storage.type) {
      case 'indexDb':
        return new IndexDbStorage(store);

      case 'memory':
        return new MemoryStorage(store);

      case 'localStorage':
        return new LocalStorage(store);
    }
  }

  public change(type, data?) {
    this._changes$.next({ type, data });
  }

  public get changes$(): Observable<Changes<T>> {
    return this._changes$.asObservable();
  }

  public get name(): string {
    return (this.constructor as typeof Store).storeName;
  }

  public get storage(): Storage {
    return this._storage;
  }

  public get config(): StoreConfig {
    return this._config;
  }

  public get keyName(): string {
    return (this.constructor as typeof Store).keyName;
  }

  public count(...operators: Operator[]): Observable<number> {
    return this.gets(...operators)
      .pipe(
        map((data) => {
          return data.length;
        }),
      );
  }

  public keys(...operators: Operator[]): Observable<string[]> {
    return this.gets(...operators)
      .pipe(
        map((data) => data
          .map((item) => item[this.keyName]),
        ),
      );
  }

  public put(data: Data<T> | Data<T>[]): Observable<void> {
    return merge(
      ...(Array.isArray(data) ? data : [data])
        .map((item) => {
          return this.get(item[this.keyName])
            .pipe(
              map((storageData: Data<T>) => {
                const _sync = {
                  revision: Number(storageData?._sync?.revision || 0),
                  date: new Date(),
                  state: SyncState.Pending,
                };

                return {
                  ...item,
                  _sync,
                };
              }),
            );
        }),
    )
      .pipe(
        switchMap((syncData) => {
          if (this._remote?.saveable && navigator.onLine) {
            return this._remote.save(syncData);
          }

          return this._storage.put(syncData)
            .pipe(
              mapTo(syncData),
            );
        }),
        tap((syncData) => {
          this.change('put', syncData);
        }),
        mapTo(null),
      );
  }

  public delete(...operators: any): Observable<any> {
    return this.gets(...operators)
      .pipe(
        switchMap((data) => {
          const keys = data.map((item) => {
            return item[this.keyName];
          });

          return this._storage.delete(keys)
            .pipe(
              tap(() => {
                keys
                  .forEach((key) => {
                    this.change('delete', { [this.keyName]: key });
                  });
              }),
            );
        }),
      );
  }

  public clear(): Observable<void> {
    return this._storage.clear()
      .pipe(
        tap(() => {
          this.change('clear');
        }),
      );
  }

  public destroy(): Observable<void> {
    this._remote?.destroy();

    return this._storage.destroy();
  }

  public get(key: string | number): Observable<T> {
    return this._storage.get(key);
  }

  public gets(...operators: Operator[]): Observable<any[]> {
    return this._storage.gets(operators);
  }

  public init(): Observable<void> {
    return this._storage.init();
  }

  public open(): Observable<void> {
    return this._storage.open();
  }

  public syncGet(): Observable<void> {
    return this._remote ? this._remote.syncGet() : of(null);
  }

  public syncSave(): Observable<void> {
    return this._remote ? this._remote.syncSave() : of(null);
  }
}
