import { Observable, Subject, concat, merge, of, throwError } from 'rxjs';
import { catchError, filter, finalize, map, mapTo, switchMap, tap, toArray } from 'rxjs/operators';

import { Data, RemoteConfig } from '../interfaces';
import { eq, not } from '../operators';

import { Store } from './store';


export class Remote<T> {

  private _syncGets$ = new Subject<any[]>();
  private _syncing = false;
  private _modifyDate: Date;
  private _gets: (query: any) => Observable<any[]>;
  private _put: (data: any) => Observable<any>;
  private _post: (data: any) => Observable<any>;

  constructor(
    private _store: Store<any>,
    private _config: RemoteConfig,
  ) {
    this._gets = this._config.gets;
    this._put = this._config.put;
    this._post = this._config.post;
  }

  public sync(): Observable<void> {
    if(this._syncing || !navigator.onLine) {
      return of(null);
    }

    this._syncing = true;

    return this._syncGets()
      .pipe(
        switchMap(() => this._syncSave()),
        finalize(() => this._syncing = false),
      );
  }

  public get sync$(): Observable<any[]> {
    return this._syncGets$.asObservable();
  }

  private _save(item): Observable<any> {
    if(item._revision.number === 1) {
      if(!this._post) {
        return throwError('Remote post method not configured');
      }

      return this._post(item);
    }

    if(!this._put) {
      return throwError('Remote put method not configured');
    }

    return this._put(item);
  }

  private _syncSave(): Observable<void> {
    if(!this._post && !this._put) {
      return of(null);
    }

    return this._store
      .gets(
        not(eq('_revision', undefined)),
      )
      .pipe(
        switchMap((data) => {
          return  concat(
            ...data.map((item: Data<any>) => {
              return this._save(item)
                .pipe(
                  this._catchError('Sync Save Error'),
                  switchMap((response) => {
                    response = {
                      ...response,
                      _revision: undefined,
                    };

                    return this._store.storage.put(response);
                  }),
                  this._catchError('Sync Storage Put Error'),
                );
            }),
          )
            .pipe(
              toArray(),
            );
        }),
        mapTo(null),
      );
  }

  private _catchError(errorType) {
    return catchError((error) => {
      console.error(errorType, error);

      return of(null)
        .pipe(
          filter(() => false),
        );
    });
  }

  private _syncGets(): Observable<void> {
    const query = {
      modifyDate: this._modifyDate,
    };

    return this._gets(query)
      .pipe(
        this._catchError('Sync Gets Error'),
        switchMap((data: any[]) => {
          if(!data?.length) {
            return of(null);
          }

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
        }),
        tap(() => {
          this._modifyDate = new Date();
        }),
        mapTo(null),
      );
  }

}
