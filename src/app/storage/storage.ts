import { Observable } from 'rxjs';

import { Data } from '../interfaces';
import { Operator } from '../types';
import { Store } from '../classes';
import { SyncState } from '../enums';


export abstract class Storage {

  constructor(
    protected _store: Store<any>,
  ) {}

  public putSynced(item: Data<any>): Observable<void> {
    const _sync = {
      ...item._sync,
      state: SyncState.Synced,
      date: new Date(),
      revision: 1,
    };

    item = {
      ...item,
      _sync,
    };

    return this.put(item);
  }

  public abstract get(key: string | number): Observable<Data<any>>;
  public abstract gets(operators?: Operator[]): Observable<Data<any>[]>;
  public abstract put(item: Data<any>[] | Data<any>): Observable<void>;
  public abstract clear(): Observable<void>;
  public abstract delete(keys: string[]): Observable<void>;
  public abstract init(): Observable<void>;
  public abstract open(): Observable<void>;
  public abstract destroy(): Observable<void>;

}
