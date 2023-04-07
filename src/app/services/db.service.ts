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

        // switchMap(() => {
        //   return concat(
        //     ...Array.from(this._stores.values())
        //       .map((store) => store.init()),
        //   );
        //   //return this._sequantialInit(Array.from(this._stores.values()));
        // }),
        switchMap(() => {
          return [
            ...Array.from(this._stores.values())
              .map((store) => store.init()),
            ...Array.from(this._stores.values())
              .map((store) => store.open()),
          ]
            .reduce((o1$,o2$) => o1$.pipe(switchMap((o1) => o2$)));
          //return this._sequantialOpen(Array.from(this._stores.values()));
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

  private _sequantialInit(stores: Store<any>[]) {
    const store = stores.pop();

    if(!store) {
      return of(true);
    }

    return of(true)
      .pipe(
        switchMap(() => store.init()),
        switchMap(() => this._sequantialInit(stores)),
      );
  }

  private _sequantialOpen(stores: Store<any>[]) {
    const store = stores.pop();

    if(!store) {
      return of(true);
    }

    return of(true)
      .pipe(
        switchMap(() => store.open()),
        switchMap(() => this._sequantialOpen(stores)),
      );
  }

}
