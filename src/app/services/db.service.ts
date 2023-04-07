import { Injectable } from '@angular/core';

import { Observable, Subject,  concat,  of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { Store } from '../classes';


@Injectable({
  providedIn: 'root',
})
export class FsDb {

  private _stores = new Map<string,Store<any>>();
  private _ready$ = new Subject();
  private _ready = false;

  public register(store: Store<any>): FsDb {
    this._stores.set(store.constructor.name, store);

    return this;
  }

  public store(store): Store<any> {
    return this._stores.get(store.name);
  }

  public init(): Observable<any> {
    return of(true)
      .pipe(
        switchMap(() => {
          return Array.from(this._stores.values())
            .map((store: Store<any>) => store.init())
            .reduce((o1$, o2$) => o1$.pipe(switchMap(() => o2$)));
        }),
        switchMap(() => {
          return concat(
            ...Array.from(this._stores.values())
              .map((store: Store<any>) => store.open()),
          );
        }),
        tap(() => {
          this._ready$.next(null);
          this._ready$.complete();
        }),
        catchError((error) => {
          this._ready$.error(error);

          return throwError(error);
        }),
      );
  }

  public sync(): Observable<any> {
    return concat(
      ...Array.from(this._stores.values())
        .map((store: Store<any>) => store.sync()),
    );
  }

  public clear(): Observable<any> {
    return concat(
      ...Array.from(this._stores.values())
        .map((store: Store<any>) => store.clear()),
    );
  }

  public get ready$() {
    if(!this._ready) {
      return this._ready$.asObservable();
    }

    return of(true);
  }

}