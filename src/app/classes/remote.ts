import { Observable, Subject, merge, of } from 'rxjs';
import { catchError, finalize, map, mapTo, switchMap, tap, toArray } from 'rxjs/operators';

import { Data, RemoteConfig } from '../interfaces';
import { eq, not } from '../operators';

import { Store } from './store';


export class Remote<T> {

  private _syncGets$ = new Subject<any[]>();
  private _modifyDate: Date;
  private _gets: (query: any) => Observable<any[]>;
  private _put: (data: any) => Observable<any>;
  private _post: (data: any) => Observable<any>;
  private _syncing = false;

  constructor(
    private _store: Store<any>,
    private _config: RemoteConfig,
  ) {
    this._gets = this._config.gets;
    this._put = this._config.put;
    this._post = this._config.post;
  }

  public sync(): Observable<void> {
    if(this._syncing) {
      return of(null);
    }

    this._syncing = true;
    const query = {
      modifyDate: this._modifyDate,
    };

    return this._gets(query)
      .pipe(
        catchError((error) => {
          console.error(error);

          return of(null);
        }),
        switchMap((data: any[]) => {
          if(data?.length === 0) {
            return of(null);
          }

          return this._syncGets(data)
            .pipe(
              switchMap(() => this._syncPut()),
              tap(() => {

                this._modifyDate = new Date();
              }),
            );
        }),
        mapTo(null),
        finalize(() => this._syncing = false),
      );
  }

  public get sync$(): Observable<any[]> {
    return this._syncGets$.asObservable();
  }

  private _syncPut() {
    return this._store
      .gets(
        not(eq('_revision', undefined)),
      )
      .pipe(
        switchMap((data) => {
          return  merge(
            ...data.map((item: Data<any>) => {
              const save$ = (
                item._revision.number === 1 ?
                  this._post(item) :
                  this._put(item)
              )
                .pipe(
                  switchMap((response) => {
                    response = {
                      ...response,
                      _revision: undefined,
                    };

                    return this._store.storage.put(response);
                  }),
                );

              return save$
                .pipe(
                  catchError((error) => {
                    console.error('Sync Put Error', error);

                    return of(null);
                  }),
                );
            }),
          )
            .pipe(
              toArray(),
            );
        }),
      );
  }

  private _syncGets(data: any[]) {
    return merge(
      ...data
        .map((item) => this._store.storage.get(item[this._store.keyName])),
    )
      .pipe(
        toArray(),
        map((stoageData) => stoageData.reduce((accum, item) => {
          return item ? {
            ...accum,
            [item[this._store.keyName]]: item,
          } : accum;
        }, {})),
        switchMap((storageData: { [key: string]: any }) => {
          const remoteData = data
            .filter((item) => {
              return !storageData[item[this._store.keyName]]?._revision;
            })
            .map((item) => this._store.storage.put(item));

          return merge(
            ...remoteData,
          )
            .pipe(
              toArray(),
            );
        }),
      );

  }

}
