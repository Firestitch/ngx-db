import { Observable, Subscriber, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { IndexDbIterable } from '../iterable';
import { Operator } from '../types';
import { IndexDbDescribe } from '../interfaces';

import { OperatorData } from './operator-data';


export class IndexDb {

  private _request: IDBOpenDBRequest;
  private _db: IDBDatabase;

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

  public get describe(): Observable<IndexDbDescribe> {
    return this.open()
      .pipe(
        map((db: IDBDatabase) => {
          return {
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
          };
        }),
        switchMap((describe: IndexDbDescribe) => {
          this.close();

          return of(describe);
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
        switchMap(() => {
          this.close();

          return of(null);
        }),
      );
  }

  public get(store: string, id: string | number): Observable<any> {
    if(id === null || id === undefined) {
      return of(null);
    }

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

  public data(store: string, operators: Operator[]): Observable<any[]> {
    const operatorData = new OperatorData(operators);
    const iterable = new IndexDbIterable(this._db, store, operatorData);

    return iterable.data$;
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

  public close(): Observable<void> {
    this._db?.close();
    this._db = null;

    return of(null);
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
