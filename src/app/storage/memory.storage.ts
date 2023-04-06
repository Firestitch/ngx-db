import { Observable, Subject, of } from 'rxjs';

import { Store } from '../classes';

import { Storage } from './storage';


export class MemoryStorage extends Storage {

  private _data = {};
  private _values$ = new Subject<any[]>();

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
      [this._store.config.keyName]: item,
    };

    this._emitValues();

    return of(null);
  }

  public clear(): Observable<void> {
    this._data = {};
    this._emitValues();

    return of(null);
  }

  public delete(keys: string[]): Observable<void> {
    keys.forEach((key) => {
      delete this._data[key];
    });

    this._emitValues();

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

  private _emitValues() {
    if(this._values$.observers.length) {
      this._values$.next(Object.values(this._data));
    }
  }

}
