import { Observable, Subscriber, concat, of } from 'rxjs';
import { finalize, map, switchMap, tap, toArray } from 'rxjs/operators';

import { Operator } from '../types';
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

  public get(store: string, id: string | number): Observable<any> {
    if(id === null || id === undefined) {
      return of(null);
    }

    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
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

  public delete(store: string, keys: string | string[]): Observable<any> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
          const transaction = db.transaction(store, 'readwrite');
          const objectStore = transaction.objectStore(store);
          keys = Array.isArray(keys) ? keys : [keys];

          return concat(...keys.map((key) => {
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

  public put(store, data): Observable<any> {
    return this.open()
      .pipe(
        switchMap((db: IDBDatabase) => {
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
        observer.next();
        observer.complete();
      };
    });

  }
}
