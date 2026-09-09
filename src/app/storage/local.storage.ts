import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { OperatorData, applyLimit, applyMap, applySort } from '../classes';
import { Data } from '../interfaces';
import { Operator, StorageKey } from '../types';

import { Storage } from './storage';


export class LocalStorage extends Storage {

  public gets(operators: Operator[] = []): Observable<Data<any>[]> {
    const operatorData = new OperatorData(operators);

    return this.data
      .pipe(
        switchMap((stored) => {
          let data = Object.values(stored || {})
            .filter((item: any) => operatorData.match(item))
            .map((item: any) => ({ ...item }));

          data = applySort(data, operatorData.sortOperators);
          data = applyLimit(data, operatorData);

          return applyMap(data, operatorData);
        }),
      );
  }

  public clear(): Observable<void> {
    this._setItem({});

    return of(null);
  }

  public delete(keys: StorageKey[]): Observable<void> {
    return this.data
      .pipe(
        map((data) => {
          const removing = new Set(keys.map((key) => String(key)));

          this._setItem(Object.fromEntries(
            Object.entries(data || {})
              .filter(([key]) => !removing.has(key)),
          ));

          return null;
        }),
      );
  }

  public get(key: StorageKey): Observable<Data<any>> {
    return this.data
      .pipe(
        map((data) => data[key]),
      );
  }

  public put(value: Data<any> | Data<any>[]): Observable<void> {
    return this.data
      .pipe(
        switchMap((data) =>{
          if(Array.isArray(value)) {
            value.forEach((item) => {
              data = {
                ...data,
                [item[this._store.keyName]]: {
                  ...item,
                },
              };
            });
          } else {
            data = {
              ...data,
              [value[this._store.keyName]]: {
                ...value,
              },
            };
          }

          this._setItem(data);

          return of(null);
        }),
      );
  }

  public get data(): Observable<{ [key: string]: any}> {
    const data = JSON.parse(localStorage.getItem(this._store.name));

    return of(data);
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

  // localStorage keeps one blob per store, so destroy and clear are the same
  // operation.
  public destroy(): Observable<void> {
    return this.clear();
  }

  private _setItem(data: { [key: string]: Data<any> }): void {
    localStorage.setItem(this._store.name, JSON.stringify(data));
  }

}
