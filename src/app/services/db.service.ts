import { Injectable } from '@angular/core';

import { Observable, Subject, concat, merge, of, throwError, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil, tap, toArray } from 'rxjs/operators';

import { Store } from '../classes';
import { StoreClass } from '../types';
import { DestroyOptions } from '../interfaces';


@Injectable({
  providedIn: 'root',
})
export class FsDb {

  private _stores = new Map<string, Store<any>>();
  private _ready$ = new Subject<void>();
  private _sync$ = new Subject<void>();
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

  public store<T = any>(store: string | StoreClass): Store<T> {
    if (typeof (store) === 'string') {
      return this._stores.get(store);
    }

    return this._stores.get(store.storeName);
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
          // _ready must flip here: once _ready$ has completed it emits nothing to
          // late subscribers, so ready$ has to fall back to of(true) for anyone
          // subscribing after init(). Without this, a subscriber that arrives late
          // waits forever.
          this._ready = true;
          this._ready$.next();
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

  /**
   * Starts polling every `seconds` until stopSync() is called.
   *
   * The returned Observable reports the *first* sync round: it emits once and
   * completes on success, or errors if that first round fails. Polling continues
   * either way — later rounds keep running and report failures via console.
   *
   * The polling loop deliberately does NOT live on this Observable's
   * subscription: completing/erroring it would otherwise run the teardown and
   * unsubscribe the very timer it is reporting on, killing sync after one round.
   * stopSync() is what ends the loop.
   */
  public startSync(seconds: number): Observable<void> {
    this._sync$ = new Subject();

    const firstRound$ = new Subject<void>();
    let reported = false;

    // Report only the first round, then stay silent. Guarded so a completed
    // Subject is never written to again.
    const report = (error?: any): void => {
      if (reported) {
        return;
      }

      reported = true;

      if (error) {
        firstRound$.error(error);
      } else {
        firstRound$.next();
        firstRound$.complete();
      }
    };

    timer(0, seconds * 1000)
      .pipe(
        filter(() => navigator.onLine),
        // Each round catches its own errors so one failure cannot tear down the
        // polling loop.
        switchMap(() => this.sync()
          .pipe(
            tap(() => report()),
            catchError((error) => {
              console.error('Sync Error', error);
              report(error);

              return of(null);
            }),
          ),
        ),
        takeUntil(this._sync$),
      )
      .subscribe();

    return firstRound$.asObservable();
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

  public destroy(options?: DestroyOptions): Observable<any> {
    this.stopSync();

    return concat(
      ...Array.from(this._stores.values())
        .map((store: Store<any>) => store.destroy(options)),
    )
      .pipe(
        toArray(),
      );
  }

  public get ready$(): Observable<any> {
    if (!this._ready) {
      return this._ready$.asObservable();
    }

    return of(true);
  }

}
