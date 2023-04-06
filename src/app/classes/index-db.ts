import { Observable, Subscriber, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { DbIterable, IndexDbIterable } from '../iterable';
import { Operator } from '../types';

import { Store } from '.';


export class IndexDb {

  private _request: IDBOpenDBRequest;
  private _db: IDBDatabase;

  constructor(
    private _dbName: string = 'fsDb',
  ) {}

  public init(stores: Store<any>[]): Observable<void> {
    return this.describe
      .pipe(
        switchMap((describe: IndexDbDescribe) => {
          const newStores =
            stores
              .filter((store) => {
                return Array.from(describe.objectStoreNames).indexOf(store.name) === -1;
              });

          if(!newStores.length) {
            return of(null);
          }

          const config = {
            version: describe.version + 1,
            upgrade: (event: any) => {
              const db = event.target.result;

              stores
                .forEach((store) => {
                  db.createObjectStore(store.name, {
                    keyPath: store.config.keyName,
                  });
                });
            },
          };

          return this.open(config)
            .pipe(
              tap(() => this.close()),
            );
        }),
      );
  }

  public get describe(): Observable<IndexDbDescribe> {
    return this.open()
      .pipe(
        map((db: IDBDatabase) => {
          return {
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
          };
        }),
        tap(() => this.close()),
      );
  }

  public open(
    config?: {
      version?: number;
      upgrade?: (event: IDBVersionChangeEvent) => void;
    },
  ): Observable<IDBDatabase> {
    return new Observable((observer) => {
      this._request = window.indexedDB.open(this._dbName, config?.version);

      if(config?.upgrade) {
        this._request.onupgradeneeded = config.upgrade;
      }

      this._request.onsuccess = (event: any) => {
        this._db = event.target.result;
        observer.next(this._db);
        observer.complete();
      };

      this._request.onerror = (event: any) => {
        this._db = null;
        observer.error(event);
      };
    });
  }

  public get(store: string, id): Observable<any> {
    return new Observable((observer) => {
      const transaction = this._db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        observer.next(request.result);
        observer.complete();
      };

      request.onerror = (event) => {
        observer.error(event);
      };
    });
  }

  public clear(store: string): Observable<any> {
    return new Observable((observer) => {
      const transaction = this._db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.clear();

      request.onsuccess = () => {
        observer.next(request.result);
        observer.complete();
      };

      request.onerror = (event) => {
        observer.error(event);
      };
    });
  }

  public delete(store: string, keys: string | string[]): Observable<any> {
    return new Observable((observer) => {
      const transaction = this._db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      keys = Array.isArray(keys) ? keys : [keys];
      keys.forEach((key) => {
        const request = objectStore.delete(key);

        request.onsuccess = () => {
          observer.next(request.result);
          observer.complete();
        };

        request.onerror = (event) => {
          observer.error(event);
        };
      });
    });
  }

  public data(store: string, operators: Operator[]): Observable<DbIterable> {
    return new Observable((observer: Subscriber<any>) => {
      observer.next(new IndexDbIterable(this._db, store, operators));
      observer.complete();
    });
  }

  public put(store, data): Observable<any> {
    return new Observable((observer: Subscriber<any>) => {
      const transaction = this._db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put(data);

      request.onsuccess = () => {
        observer.next(null);
        observer.complete();
      };

      request.onerror = (event) => {
        observer.error(event);
      };
    });
  }

  public close(): void {
    if(this._db) {
      this._db.close();
      this._db = null;
    }
  }
}


interface IndexDbDescribe {
  version: number;
  objectStoreNames: string[];
}
