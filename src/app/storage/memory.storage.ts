import { Observable, Subject, of } from 'rxjs';

import { Store } from '../classes';

import { Storage } from './storage';


export class MemoryStorage extends Storage {

  private _data = {};

  constructor(
    private _store: Store<any>,
  ) {
    super();
  }

  public gets(operators: any[]): Observable<any> {
    return of(null);
  }

  public put(item: any): Observable<void> {
    this._data = {
      ...this.data,
      [this._store.keyName]: item,
    };

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

}
