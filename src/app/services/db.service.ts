import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable, Subject, forkJoin, of, throwError, zip } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';

import { IndexDb, Remote, Store } from '../classes';
import { IndexDbStorage } from '../storage';


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
          const indexDbStores = Array.from(this._stores.values())
            .filter((store) => {
              return store.storage instanceof IndexDbStorage;
            });

          if(!indexDbStores.length) {
            return of(null);
          }

          return (new IndexDb())
            .init(indexDbStores);
        }),
        switchMap(() => {
          return forkJoin(
            Array.from(this._stores.values())
              .map((store) => store.storage.init()),
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

  public get ready$() {
    if(!this._ready) {
      return this._ready$.asObservable();
    }

    return of(true);
  }

}
