import { Observable, of } from 'rxjs';

import { OperatorData } from '../classes';
import { Data } from '../interfaces';

import { Storage } from './storage';


export class MemoryStorage extends Storage {

  private _data = {};

  public gets(operators: any[]): Observable<any> {
    const operatorData = new OperatorData(operators);
    const data = Object.values(this._data)
      .filter((item: any, index: number) => {
        return operatorData.match(item, index);
      });

    return of(data);
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

  public delete(keys: string[]): Observable<void> {
    keys.forEach((key) => {
      delete this._data[key];
    });

    return of(null);
  }

  public get(key: string): Observable<any> {
    return of(this._data[key]);
  }

  public get data(): Observable<{ [key: string]: any}> {
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

  public destroy(): Observable<void> {
    return of(null);
  }

}
