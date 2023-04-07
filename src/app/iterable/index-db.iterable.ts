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
      const limitOperator = this._operators
        .find((operator: Operator) => (operator as any).type === 'limit');

      const limit: {
        offset: number;
        limit: number;
        count: number;
      } = limitOperator ? limitOperator() : null;

      request.onsuccess = (event: any) => {
        if(event.target.result) {
          const value = event.target.result.value;

          const filters = this._operators
            .filter((operator: any) => {
              return operator.type === 'filter';
            });

          const match = filters.length === 0 ||
            filters.every((operator: Operator) => {
              return operator(value, index, length);
            });

          if(match) {

            if(!limit || index >= limit.offset) {
              observer.next(value);
            }

            index++;
          }

          if(limit && limit.count === index - limit.offset) {
            return observer.complete();
          }

          event.target.result.continue();
        } else {
          observer.complete();
        }
      };

      request.onerror = () => {
        observer.error();
      };
    });

  }
}

