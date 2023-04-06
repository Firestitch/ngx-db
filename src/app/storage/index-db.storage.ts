import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { IndexDb, Store } from '../classes';
import { DbIterable } from '../iterable';

import { Storage } from './storage';


export class IndexDbStorage extends Storage {

  private _indexDB = new IndexDb();

  constructor(
    private _store: Store<any>,
  ) {
    super();
  }

  public gets(operators: any[]): Observable<any[]> {
    return this._indexDB.data(this._store.name, operators)
      .pipe(
        switchMap((dbIterable: DbIterable) => dbIterable.data),
      );
  }

  public put(item: any): Observable<void> {
    return this._indexDB.put(this._store.name, item)
      .pipe(
        tap(() => this.change()),
      );
  }

  public clear(): Observable<void> {
    return this._indexDB.clear(this._store.name)
      .pipe(
        tap(() => this.change()),
      );
  }

  public delete(keys: string[]): Observable<void> {
    return this._indexDB.delete(this._store.name, keys)
      .pipe(
        tap(() => this.change()),
      );
  }

  public get(key: string): Observable<any> {
    return this._indexDB.get(this._store.name, key)
      .pipe(
        map((data) => data || null),
      );
  }

  public init(): Observable<void> {
    return this._indexDB.open()
      .pipe(
        map(() => null),
      );
  }
}
