import { Observable, concat, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { IndexDb, Store } from '../classes';
import { DbIterable } from '../iterable';
import { IndexDbDescribe } from '../interfaces';
import { Operator } from '../types';

import { Storage } from './storage';


export class IndexDbStorage extends Storage {

  private _indexDB = new IndexDb();

  constructor(
    private _store: Store<any>,
  ) {
    super();
  }

  public gets(operators: any[]): Observable<any[]> {
    return this._indexDB.data(this._store.name, operators);
  }

  public put(data: any): Observable<void> {
    return of(null)
      .pipe(
        switchMap(() => {
          if(!Array.isArray(data)) {
            data = [data];
          }

          return concat(
            ...data
              .map((item) => this._indexDB.put(this._store.name, item)),
          );
        }),
        map(() => null),
      );
  }

  public clear(): Observable<void> {
    return this._indexDB.clear(this._store.name);
  }

  public delete(keys: string[]): Observable<void> {
    return this._indexDB.delete(this._store.name, keys);
  }

  public get(key: string): Observable<any> {
    return this._indexDB.get(this._store.name, key)
      .pipe(
        map((data) => data || null),
      );
  }

  public open(): Observable<void> {
    return of(true)
      .pipe (
        switchMap(() => this._indexDB.open()),
        map(() => null),
      );
  }

  public init(): Observable<void> {
    return of(true)
      .pipe (
        switchMap(() => (new IndexDb()).describe),
        switchMap((describe: IndexDbDescribe) => {
          if(Array.from(describe.objectStoreNames).indexOf(this._store.name) !== -1) {
            return of(null);
          }

          const version = describe.version + 1;
          const upgrade = (event: any) => {
            const db = event.target.result;
            db.createObjectStore(this._store.name, {
              keyPath: this._store.keyName,
            });
          };

          return (new IndexDb()).upgrade(version, upgrade);
        }),
        map(() => null),
      );
  }
}
