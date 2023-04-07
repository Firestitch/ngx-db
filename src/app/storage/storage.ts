import { Observable, Subject } from 'rxjs';


export abstract class Storage {

  private _changes$ = new Subject<{ type?: 'put' | 'delete' }>();

  public change() {
    this._changes$.next(null);
  }

  public get changes$(): Observable<any> {
    return this._changes$.asObservable();
  }

  public abstract get(key: string): Observable<any>;
  public abstract gets(operators?: any[]): Observable<any[]>;
  public abstract put(item: any[] | any): Observable<void>;
  public abstract clear(): Observable<void>;
  public abstract delete(keys: string[]): Observable<void>;
  public abstract init(): Observable<void>;
  public abstract open(): Observable<void>;

}
