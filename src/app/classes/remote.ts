import { Observable, of } from 'rxjs';
import { switchMap, take, tap } from 'rxjs/operators';

import { Store } from './store';


export class Remote {

  constructor(
    private _gets$: (query: any) => Observable<any[]>,
    private _put$: (data: any) => Observable<any>,
    private _delete$: (data: any) => Observable<any>,
    private _config: { revisionName?: string },
  ) {
  }

  public gets(query?: any): Observable<any> {
    return this._gets$(query);
  }

  public put(data): Observable<any> {
    return this._put$(data);
  }

  public delete(data): Observable<any> {
    return this._delete$(data);
  }

  public sync(store: Store<any>): Observable<void> {
    return this.gets()
      .pipe(
        take(1),
        switchMap((data: any[]) => {
          return store.put(data, { change: false });
        }),
      );
  }

}
