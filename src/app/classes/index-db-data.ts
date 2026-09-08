import { Observable, Subscriber } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { Operator } from '../types';

import { applyLimit, applyMap, applySort } from './operator-apply';
import { OperatorData } from './operator-data';


export class IndexDbData {

  private _data = [];
  private _transaction: IDBTransaction;
  private _objectStore: IDBObjectStore;

  constructor(
    private _db: IDBDatabase,
    private _store: string,
    private _operatorData: OperatorData,
  ) {
    this._transaction = this._db.transaction(this._store, 'readonly');
    this._objectStore = this._transaction.objectStore(this._store);
  }

  public get sortOperators(): Operator[] {
    return this._operatorData.sortOperators
      .filter((operator: any) => {
        return !this._objectStore.indexNames.contains(operator().name);
      });
  }

  public get keySortOperator(): Operator {
    return this._operatorData.sortOperators
      .find((operator: any) => {
        return this._objectStore.indexNames.contains(operator().name);
      });
  }

  public get data$(): Observable<any> {
    const keySortOperator = this.keySortOperator;

    let cursor: IDBObjectStore | IDBIndex = this._objectStore;
    if (keySortOperator) {
      const keySortConfig = keySortOperator();
      cursor = this._objectStore.index(keySortConfig.name);
    }

    return new Observable((observer: Subscriber<any>) => {
      const request = cursor.openCursor();

      request.onsuccess = (event: any) => {
        if (!event.target.result) {
          return this._complete(observer);
        }

        const value = event.target.result.value;

        if (this._operatorData.match(value)) {
          this._data.push(value);
        }

        event.target.result.continue();
      };

      request.onerror = (event) => {
        observer.error(event);
      };
    })
      .pipe(
        // Sorting handled by an IndexedDB index is skipped here; the remaining
        // sorts, plus limit and the map operators, are shared with the other
        // storage backends so every backend behaves the same.
        tap(() => {
          this._data = applySort(this._data, this.sortOperators);
          this._data = applyLimit(this._data, this._operatorData);
        }),
        switchMap(() => applyMap(this._data, this._operatorData)),
      );
  }

  private _complete(observer) {
    observer.next(this._data);
    observer.complete();
  }

}
