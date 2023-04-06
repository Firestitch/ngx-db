import { Observable, Subscriber } from 'rxjs';

import { Operator } from '../types';

import { DbIterable } from './db.iterable';


export class IndexDbIterable extends DbIterable {

  constructor(
    private _db: IDBDatabase,
    private _store: string,
    private _operators: Operator[],
  ) {
    super();
  }

  public get data$(): Observable<any> {
    const transaction = this._db.transaction(this._store, 'readonly');
    const objectStore = transaction.objectStore(this._store);

    return new Observable((observer: Subscriber<any>) => {
      const request = objectStore.openCursor();
      let index = 0;

      request.onsuccess = (event: any) => {
        if(event.target.result) {
          const value = event.target.result.value;

          const match = this._operators.length === 0 ||
             this._operators.every((operator: Operator) => {
               return operator(value, index, length);
             });

          if(match) {
            observer.next(value);
          }

          event.target.result.continue();
        } else {
          observer.complete();
        }

        index++;
      };

      request.onerror = () => {
        observer.error();
      };
    });

  }
}

