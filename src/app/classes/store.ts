import { Observable, Subject, of } from 'rxjs';
import {  map,  switchMap, takeUntil, tap } from 'rxjs/operators';

import { IndexDbStorage, Storage } from '../storage';
import { Changes, StoreConfig } from '../interfaces';
import { Operator } from '../types';

import { Remote } from './remote';


export abstract class Store<T> {

  private _destroy$ = new Subject();
  private _storage: Storage;
  private _remote: Remote;
  private _changes$ = new Subject<Changes<T>>();

  protected abstract _keyName: string;

  constructor(
    private _config: StoreConfig,
  ) {
    this._storage = this.config?.storage ?? new IndexDbStorage(this);
    this._remote = this.config?.remote;
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
        map((data) => data.length),
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

  public put(data: T | T[], config?: { change?: boolean }): Observable<void> {
    return this._storage.put(data)
      .pipe(
        tap(() => {
          if((config?.change ?? true)) {
            this.change('put', data );
          }
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

  public clear(config?: { change?: boolean }): Observable<void> {
    return this._storage.clear()
      .pipe(
        tap(() => {
          if((config?.change ?? true)) {
            this.change('clear');
          }
        }),
      );
  }

  public get(key: string): Observable<T> {
    return this._storage.get(key);
  }

  public gets(...operators: Operator[]): Observable<any[]> {
    return this._storage.gets(operators);
  }

  public destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public init(): Observable<void> {
    if(this._remote) {
      this.changes$
        .pipe(
          switchMap((changes) => {
            switch(changes.type) {
              case 'put':
                return this._remote.put(changes.data);

              case 'delete':
                return this._remote.delete(changes.data);
            }

            return of(null);
          }),
          takeUntil(this._destroy$),
        )
        .subscribe();
    }

    return this._storage.init();
  }

  public open(): Observable<void> {
    return this._storage.open();
  }

  public sync(): Observable<void> {
    return this._remote ? this._remote.sync(this) : of(null);
  }
}
