import { Observable, Subject, of } from 'rxjs';
import {  map,  switchMap } from 'rxjs/operators';

import { IndexDbStorage, Storage } from '../storage';
import { StoreConfig } from '../interfaces';
import { Operator } from '../types';

import { Remote } from './remote';


export class Store<T> {

  private _destroy$ = new Subject();
  private _storage: Storage;
  private _remote: Remote;

  constructor(
    private _config: StoreConfig,
  ) {
    this._storage = this.config?.storage ?? new IndexDbStorage(this);
    this._remote = this.config?.remote;
  }

  public get changes$(): Observable<any> {
    return this._storage.changes$;
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
    return this.config.keyName;
  }

  public count(...operators: Operator[]): Observable<number> {
    return this.keys(...operators)
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

  public clear(): Observable<void> {
    return this._storage.clear();
  }

  public delete(...operators: any): Observable<any> {
    if(operators.length === 0) {
      return this._storage.clear();
    }

    return this.gets(...operators)
      .pipe (
        switchMap((data) => {
          data = data.map((item) => {
            return item[this.keyName];
          });

          return this._storage.delete(data);
        }),
      );
  }

  public put(data: T | T[]): Observable<void> {
    return this._storage.put(data);
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

  public open(): Observable<void> {
    return this._storage.open()
      .pipe(
        // switchMap(() => {
        //   return this._remote ? this._remote.sync(this) : of(null);
        // }),
      );
  }

  public init(): Observable<void> {
    return this._storage.init();
  }
}
