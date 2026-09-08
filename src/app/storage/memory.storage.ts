import { Observable, of } from 'rxjs';

import { OperatorData, applyLimit, applyMap, applySort } from '../classes';
import { SyncState } from '../enums';
import { Data, DestroyOptions } from '../interfaces';
import { Operator, StorageKey } from '../types';

import { Storage } from './storage';


export class MemoryStorage extends Storage {

  private _data: { [key: string]: Data<any> } = {};

  public gets(operators: Operator[] = []): Observable<Data<any>[]> {
    const operatorData = new OperatorData(operators);
    let data = Object.values(this._data)
      .filter((item: any) => {
        return operatorData.match(item);
      })
      .map((item: any) => ({ ...item }));

    data = applySort(data, operatorData.sortOperators);
    data = applyLimit(data, operatorData);

    return applyMap(data, operatorData);
  }

  public put(data: Data<any>[] | Data<any>): Observable<void> {
    data = Array.isArray(data) ? data : [data];
    data.forEach((item) => {
      this._data = {
        ...this._data,
        [item[this._store.keyName]]: item,
      };
    });

    return of(null);
  }

  public clear(): Observable<void> {
    this._data = {};

    return of(null);
  }

  public delete(keys: StorageKey[]): Observable<void> {
    const removing = new Set(keys.map((key) => String(key)));

    this._data = Object.fromEntries(
      Object.entries(this._data)
        .filter(([key]) => !removing.has(key)),
    );

    return of(null);
  }

  public get(key: StorageKey): Observable<Data<any>> {
    return of(this._data[key]);
  }

  public get data(): Observable<{ [key: string]: any }> {
    return of(this._data);
  }

  public init(): Observable<void> {
    return of(null);
  }

  public open(): Observable<void> {
    return of(null);
  }

  public close(): Observable<void> {
    return of(null);
  }

  // Memory storage is discarded with the page, but honour preserveUnsynced so the
  // option behaves consistently across backends instead of being ignored.
  public destroy(options?: DestroyOptions): Observable<void> {
    if(options?.preserveUnsynced) {
      this._data = Object.fromEntries(
        Object.entries(this._data)
          .filter(([, item]) => {
            const state = item._sync?.state;

            return state && state !== SyncState.Synced;
          }),
      );

      return of(null);
    }

    return this.clear();
  }

}
