import { Injectable } from '@angular/core';

import { Observable, Subject, concat, merge, of, throwError, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil, tap, toArray } from 'rxjs/operators';

import { Store } from '../classes';


@Injectable({
  providedIn: 'root',
})
export class FsDb {

  private _stores = new Map<string, Store<any>>();
  private _ready$ = new Subject();
  private _sync$ = new Subject();
  private _ready = false;

  public register(store: Store<any>): FsDb {
    if (!store.name) {
      throw new Error('Store missing storeName');
    }

    if (!store.keyName) {
      throw new Error('Store missing storeKey');
    }

    this._stores.set(store.name, store);

    return this;
  }

  public store(store: string | any): Store<any> {
    if (typeof (store) === 'string') {
      return this._stores.get(store);
    }

    return this._stores.get((store as any).storeName);
  }

  public get stores(): Store<any>[] {
    return Array.from(this._stores.values());
  }

  public init(): Observable<any> {
    return of(true)
      .pipe(
        switchMap(() => {
          return concat(
            ...[
              ...Array.from(this._stores.values())
                .map((store: Store<any>) => store.init()),
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
        switchMap(() => concat(
          ...stores
            .map((store: Store<any>) => store.syncSave()),
        )),
        toArray(),
      );
  }

  public startSync(seconds): Observable<void> {
    return new Observable((observer) => {
      this._sync$ = new Subject();

      timer(0, seconds * 1000)
        .pipe(
          filter(() => {
            return navigator.onLine;
          }),
          switchMap(() => this.sync()),
          tap(() => {
            observer.next(null);
            observer.complete();
          }),
          catchError((error) => {
            console.error('Sync Error', error);
            observer.error();

            return of(null);
          }),
          takeUntil(this._sync$),
        )
        .subscribe();
    });
  }

  public stopSync(): void {
    this._sync$.next(null);
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
    if (!this._ready) {
      return this._ready$.asObservable();
    }

    return of(true);
  }

}
