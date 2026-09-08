import { Observable, Subscriber, merge, of } from 'rxjs';
import { finalize, map, switchMap, tap, toArray } from 'rxjs/operators';

import { Operator, StorageKey } from '../types';
import { IndexDbDescribe } from '../interfaces';

import { OperatorData } from './operator-data';
import { IndexDbData } from './index-db-data';


export class IndexDb {

  private _request: IDBOpenDBRequest;

  constructor(
    private _dbName: string = 'fsDb',
  ) {}

  public open(
    config?: {
      version?: number;
      upgrade?: (event: IDBVersionChangeEvent) => void;
    },
  ): Observable<IDBDatabase> {
    return new Observable((observer) => {
      this._request = window.indexedDB.open(this._dbName, config?.version);

      this._request.onupgradeneeded = config?.upgrade;

      this._request.onsuccess = (event: any) => {
        observer.next(event.target.result);
        observer.complete();
      };

      this._request.onerror = (event: any) => {
        observer.error(event);
      };
    });
  }

  public get describe(): Observable<IndexDbDescribe> {
    return this.open()
      .pipe(
        tap((db: IDBDatabase) => {
          db.close();
        }),
        map((db: IDBDatabase) => {
          return {
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
          };
        }),
      );
  }

  public upgrade(
    version: number,
    upgrade: (event: IDBVersionChangeEvent) => void,
  ): Observable<any> {
    return this.open({
      version, upgrade,
    })
      .pipe(
        tap((db: IDBDatabase) => {
          db.close();
        }),
      );
  }

  public get(store: string, id: StorageKey): Observable<any> {
    if(id === null || id === undefined) {
      return of(null);
    }

    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          // A destroyed store is gone until init() recreates it. Reading from it
          // is "no such record", not a hard failure — throwing here killed the
          // sync loop with NotFoundError after destroy().
          if(!db.objectStoreNames.contains(store)) {
            db.close();

            return of(undefined);
          }

          return new Observable((observer) => {
            const transaction = db.transaction(store, 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.get(id);

            request.onsuccess = () => {
              observer.next(request.result);
              observer.complete();
            };

            request.onerror = (event) => {
              observer.error(event);
            };
          })
            .pipe(
              finalize(() => {
                db.close();
              }),
            );
        }),
      );
  }

  public clear(store: string): Observable<any> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          if(!db.objectStoreNames.contains(store)) {
            db.close();

            return of(null);
          }

          return new Observable((observer) => {
            const transaction = db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.clear();

            request.onsuccess = () => {
              observer.next(request.result);
              observer.complete();
            };

            request.onerror = (event) => {
              observer.error(event);
            };
          })
            .pipe(
              finalize(() => {
                db.close();
              }),
            );
        }),
      );
  }

  public delete(store: string, keys: StorageKey | StorageKey[]): Observable<any> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          if(!db.objectStoreNames.contains(store)) {
            db.close();

            return of([]);
          }

          const transaction = db.transaction(store, 'readwrite');
          const objectStore = transaction.objectStore(store);
          keys = Array.isArray(keys) ? keys : [keys];

          // merge, not concat: an IndexedDB transaction auto-commits once the
          // event loop yields with no pending requests. concat subscribes lazily,
          // so the second delete would be issued against an already committed
          // transaction and throw TransactionInactiveError. merge queues every
          // request up front, while the transaction is still active.
          return merge(...keys.map((key) => {
            return new Observable((observer) => {
              const request = objectStore.delete(key);

              request.onsuccess = () => {
                observer.next(request.result);
                observer.complete();
              };

              request.onerror = (event) => {
                observer.error(event);
              };

            });
          }))
            .pipe(
              toArray(),
              finalize(() => db.close()),
            );

        }),
      );
  }

  public data(store: string, operators: Operator[]): Observable<any[]> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          if(!db.objectStoreNames.contains(store)) {
            db.close();

            return of([]);
          }

          const operatorData = new OperatorData(operators);
          const iterable = new IndexDbData(db, store, operatorData);

          return iterable.data$
            .pipe(
              finalize(() => {
                db.close();
              }),
            );
        }),
      );
  }

  public put(store: string, data: any): Observable<any> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          // Writing to a destroyed store must not throw; the caller can init()
          // to recreate it.
          if(!db.objectStoreNames.contains(store)) {
            db.close();

            return of(null);
          }

          return new Observable((observer: Subscriber<any>) => {
            const transaction = db.transaction(store, 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.put(data);

            request.onsuccess = () => {
              observer.next(null);
              observer.complete();
            };

            request.onerror = (event) => {
              observer.error(event);
            };
          })
            .pipe(
              finalize(() => db.close()),
            );
        }),
      );
  }

  public destroyDatabase(): Observable<void> {
    return new Observable((observer) => {
      const request = window.indexedDB.deleteDatabase(this._dbName);

      request.onerror = (event) => {
        observer.error(event);
      };

      request.onsuccess = (event) => {
        observer.next(null);
        observer.complete();
      };
    });

  }
}
