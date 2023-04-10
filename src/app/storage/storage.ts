import { Observable } from 'rxjs';

import { Data } from '../interfaces';
import { Operator } from '../types';


export abstract class Storage {

  public abstract get(key: string): Observable<Data<any>>;
  public abstract gets(operators?: Operator[]): Observable<Data<any>[]>;
  public abstract put(item: Data<any>[] | Data<any>): Observable<void>;
  public abstract clear(): Observable<void>;
  public abstract delete(keys: string[]): Observable<void>;
  public abstract init(): Observable<void>;
  public abstract open(): Observable<void>;

}
