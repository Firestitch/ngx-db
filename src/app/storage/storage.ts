import { Observable, Subject } from 'rxjs';


export abstract class Storage {

  public abstract get(key: string): Observable<any>;
  public abstract gets(operators?: any[]): Observable<any[]>;
  public abstract put(item: any[] | any): Observable<void>;
  public abstract clear(): Observable<void>;
  public abstract delete(keys: string[]): Observable<void>;
  public abstract init(): Observable<void>;
  public abstract open(): Observable<void>;

}
