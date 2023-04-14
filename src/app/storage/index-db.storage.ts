import { Observable, concat, of } from 'rxjs';
import { map, mapTo, switchMap } from 'rxjs/operators';

import { IndexDb, Store } from '../classes';
import { IndexDbDescribe, StoreIndex } from '../interfaces';

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

  public close(): Observable<void> {
    return this._indexDB.close();
  }

  public destroy(): Observable<void> {
    return this.close()
      .pipe(
        switchMap(() => this._indexDB.describe),
        switchMap((indexDbDescribe: IndexDbDescribe) => {
          const version = indexDbDescribe.version + 1;
          const upgrade = (event: any) => {
            const db = event.target.result;
            db.deleteObjectStore(this._store.name);
          };

          return this._indexDB.upgrade(version, upgrade);
        }),
        mapTo(null),
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
            const objectStore = db.createObjectStore(this._store.name, {
              keyPath: this._store.keyName,
            });

            (this._store.config.indexes || [])
              .forEach((index: StoreIndex) => {
                objectStore
                  .createIndex(index.name, index.storeKey, { unique: !!index.unique });
              });
          };

          return (new IndexDb()).upgrade(version, upgrade);
        }),
        map(() => null),
      );
  }
}
