import { Observable, Subject, of } from 'rxjs';
import {  map,  switchMap, tap } from 'rxjs/operators';

import { IndexDbStorage, Storage } from '../storage';
import { StoreConfig } from '../interfaces';
import { Operator } from '../types';

import { Remote } from './remote';


export class Store<T> {

  private _destroy$ = new Subject();
  private _storage: Storage;
  private _remote: Remote;
  private _changes$ = new Subject<{ type?: 'put' | 'delete' }>();

  constructor(
    private _config: StoreConfig,
  ) {
    this._storage = this.config?.storage ?? new IndexDbStorage(this);
    this._remote = this.config?.remote;
  }

  public change() {
    this._changes$.next(null);
  }

  public get changes$(): Observable<any> {
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

  public put(data: T | T[]): Observable<void> {
    return this._storage.put(data)
      .pipe(
        tap(() => this.change()),
      );
  }

  public delete(...operators: any): Observable<any> {
    if(operators.length === 0) {
      return this._storage.clear()
        .pipe(
          tap(() => this.change()),
        );
    }

    return this.gets(...operators)
      .pipe (
        switchMap((data) => {
          const keys = data.map((item) => {
            return item[this.keyName];
          });

          return this._storage.delete(keys)
            .pipe(
              tap(() => this.change()),
            );
        }),
      );
  }

  public clear(): Observable<void> {
    return this._storage.clear()
      .pipe(
        tap(() => this.change()),
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
    return this._storage.init();
  }

  public open(): Observable<void> {
    return this._storage.open();
  }

  public sync(): Observable<void> {
    return this._remote ? this._remote.sync(this) : of(null);
  }
}
