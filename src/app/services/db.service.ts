import { Injectable } from '@angular/core';

import { Observable, Subject,  concat,  interval,  merge,  of, throwError } from 'rxjs';
import { catchError, switchMap, takeUntil, tap, toArray } from 'rxjs/operators';

import { Store } from '../classes';


@Injectable({
  providedIn: 'root',
})
export class FsDb {

  private _stores = new Map<string,Store<any>>();
  private _ready$ = new Subject();
  private _sync$ = new Subject();
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
          return concat(
            ...[
              ...Array.from(this._stores.values())
                .map((store: Store<any>) => store.init()),
              ...Array.from(this._stores.values())
                .map((store: Store<any>) => store.open()),
            ],
          )
            .pipe(
              toArray(),
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
    const stores = Array.from(this._stores.values());

    return merge(
      ...stores
        .map((store: Store<any>) => store.syncGet()),
    )
      .pipe(
        toArray(),
        switchMap(() => concat(...stores
          .map((store: Store<any>) => store.syncSave()),
        )),
        toArray(),
      );
  }

  public startSync(seconds): Observable<void> {
    this._sync$ = new Subject();

    return interval(seconds * 1000)
      .pipe(
        switchMap(() => this.sync()),
        catchError((error) => {
          console.error('Sync Error', error);

          return of(null);
        }),
        takeUntil(this._sync$),
      );
  }

  public stopSync(): void {
    this._sync$.next();
    this._sync$.complete();
  }

  public clear(): Observable<any> {
    return merge(
      ...Array.from(this._stores.values())
        .map((store: Store<any>) => store.clear()),
    );
  }

  public destroy(): Observable<any> {
    this.stopSync();

    return concat(
      ...Array.from(this._stores.values())
        .map((store: Store<any>) => store.destroy()),
    )
      .pipe(
        toArray(),
      );
  }

  public get ready$() {
    if(!this._ready) {
      return this._ready$.asObservable();
    }

    return of(true);
  }

}
