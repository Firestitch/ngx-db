import { Observable, Subject, interval, of } from 'rxjs';
import {  catchError, map,  switchMap, takeUntil, tap } from 'rxjs/operators';

import { IndexDbStorage, LocalStorage, MemoryStorage, Storage } from '../storage';
import { Changes, Data, StorageConfig, StoreConfig } from '../interfaces';
import { Operator } from '../types';

import { Remote } from './remote';


export abstract class Store<T> {

  private _storage: Storage;
  private _remote: Remote<T>;
  private _changes$ = new Subject<Changes<T>>();

  protected abstract _keyName: string;
  protected abstract _revisionName: string;

  constructor(
    private _config: StoreConfig,
  ) {
    this._config = this._config || {};
    this._storage = this.createStorage(this);

    if(_config.remote) {
      this._remote = new Remote<T>(this, _config.remote);
    }
  }

  public createStorage(store): Storage {
    this.config.storage = this.config.storage || {
      type: 'indexDb',
    };

    switch(this._config.storage.type) {
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
    return this.constructor.name;
  }

  public get storage(): Storage {
    return this._storage;
  }

  public get config(): StoreConfig {
    return this._config;
  }

  public get keyName(): string {
    return this._keyName;
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
    data = (Array.isArray(data) ? data : [data])
      .map((item) => {
        const _sync = {
          revision: Number(item._sync?.revision || 0) + 1,
          date: new Date(),
        };

        return {
          ...item,
          _sync,
        };
      });

    return this._storage.put(data)
      .pipe(
        tap(() => {
          this.change('put', data );
        }),
      );
  }

  public delete(...operators: any): Observable<any> {
    return this.gets(...operators)
      .pipe (
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

  public close(): Observable<void> {
    return this._storage.close();
  }

  public syncGet(): Observable<void> {
    return this._remote ? this._remote.syncGet() : of(null);
  }

  public syncSave(): Observable<void> {
    return this._remote ? this._remote.syncSave() : of(null);
  }
}
