import { Observable, of } from 'rxjs';

import { Store } from '../classes';
import { StorageAdapter } from '../interfaces';


export class LocalStorageAdapter implements StorageAdapter {

  constructor(
    private _store: Store<any>,
  ) {
  }

  public save(): Observable<any> {
    localStorage.setItem(this._store.name, JSON.stringify(this._store.data));

    return of(true);
  }

  public get(): Observable<{ [key: string]: any}> {
    const data = JSON.parse(localStorage.getItem(this._store.name));

    return of(data);
  }

}
