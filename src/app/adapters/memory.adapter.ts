import { Observable, of } from 'rxjs';

import { StorageAdapter } from '../interfaces';
import { Store } from '../classes';


export class MemoryStorageAdapter implements StorageAdapter {

  constructor(
    private _store: Store<any>,
  ) {
  }

  public save(): Observable<any> {

    return of(true);
  }

  public get(): Observable<{ [key: string]: any}> {
    return of({});
  }

}
