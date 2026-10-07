import { Observable, TimeoutError, concat, merge, of, throwError } from 'rxjs';
import {
  catchError, filter, finalize, map, mapTo, switchMap, tap, timeout, toArray,
} from 'rxjs/operators';

import { SyncState } from '../enums';
import { Data, RemoteConfig } from '../interfaces';
import { filter as operatorFilter } from '../operators';
import { StorageKey } from '../types';

import { Store } from './store';


export class Remote<T> {

  private _syncing = false;
  private _modifyDate: Date;
  private _limit: number;
  private _gets: (query: { limit: number; offset: number; modifyDate: Date }) => Observable<any[]>;
  private _put: (data: any) => Observable<any>;
  private _post: (data: any) => Observable<any>;
  // Records put() is sending right now. They are already in storage as pending,
  // so without this a sync round that fires mid-send would send them again
  private _sending = new Set<StorageKey>();

  constructor(
    private _store: Store<any>,
    private _config: RemoteConfig,
  ) {
    this._gets = this._config.gets;
    this._put = this._config.put;
    this._post = this._config.post;
    this._limit = this._config.limit || 100;
  }

  public startSync(): boolean {
    if (this._syncing || !navigator.onLine) {
      return false;
    }

    this._syncing = true;

    return true;
  }

  public endSync(): void {
    this._syncing = false;
  }

  public get syncing(): boolean {
    return this._syncing;
  }

  public destroy(): void {
    this._modifyDate = null;
    this._syncing = false;
  }

  public syncGet(): Observable<void> {
    if (!this._gets || this.syncing) {
      return of(null);
    }

    this.startSync();

    return this._getAllPages()
      .pipe(
        catchError(() => {
          return of(null)
            .pipe(
              filter(() => false),
            );
        }),
        switchMap((remoteData: any[]) => {
          if (!remoteData?.length) {
            return of(null);
          }

          // From the remote data get the storage data
          return merge(
            ...remoteData
              .map((item) => this._store.storage.get(item[this._store.keyName])),
          )
            .pipe(
              toArray(),
              map((storageData) => {
                // Index the storage data by the storage key
                storageData = storageData
                  .reduce((accum, item) => {
                    return item ? {
                      ...accum,
                      [item[this._store.keyName]]: item,
                    } : accum;
                  }, {});

                return storageData;
              }),
              switchMap((storageData: { [key: string]: any }) => {
                remoteData = remoteData
                  .filter((item) => {
                    // Only overwrite records that have no local sync state or are
                    // already Synced. `|| SyncState.Synced` was always truthy (it is
                    // the non-empty string 'synced'), so this filter accepted every
                    // record and a remote pull clobbered local Pending/Error edits.
                    const syncState = storageData[item[this._store.keyName]]?._sync?.state;

                    return !syncState || syncState === SyncState.Synced;
                  })
                  .map((item) => {
                    return this._store.storage.putSynced(item);
                  });

                if (remoteData.length === 0) {
                  return of(null);
                }

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
        tap(() => this.endSync()),
        finalize(() => {
          this.endSync();
        }),
      );
  }

  public syncSave(): Observable<void> {
    if ((!this._post && !this._put) || this.syncing) {
      return of(null);
    }

    this.startSync();

    return this._store
      .gets(
        operatorFilter((item: Data<any>) => {
          return item._sync?.state === SyncState.Pending
            && !this._sending.has(item[this._store.keyName]);
        }),
      )
      .pipe(
        switchMap((data: any[]) => {
          if (!data?.length) {
            return of(null);
          }

          return concat(
            ...data.map((item: Data<any>) => {
              return this.save(item)
                .pipe(
                  catchError((error) => {
                    console.error('Sync save error', error);

                    return of(null);
                  }),
                );
            }),
          )
            .pipe(
              toArray(),
            );
        }),
        mapTo(null),
        tap(() => this.endSync()),
        finalize(() => {
          this.endSync();
        }),
      );
  }

  public get saveable(): boolean {
    return !!this._post || !!this._put;
  }

  /**
   * The send put() makes straight away, for a record it has already written to
   * storage as pending. Emits the record once it is either synced or left
   * pending for the next sync; errors only when the server refused it.
   *
   * "Could not be sent" and "refused" are different outcomes. navigator.onLine
   * only says a network is attached, so on Wi-Fi with no internet behind it, or
   * a signal too weak to carry data, the send fails or hangs although the
   * device reports a connection. The record is safe in storage, so that is not
   * a failure the caller needs to hear about: the next sync sends it.
   */
  public send(item: Data<T>): Observable<Data<T>> {
    const key: StorageKey = item[this._store.keyName];

    this._sending.add(key);

    // save() rewrites _sync on what it is given; the pending copy is kept intact
    return this.save({ ...item, _sync: { ...item._sync } })
      .pipe(
        this._config.saveTimeout
          ? timeout({ first: this._config.saveTimeout })
          : (source) => source,
        map(() => item),
        catchError((error: unknown) => {
          if (!this._queueOnError(error)) {
            return throwError(() => error);
          }

          // save() marks a failed update as Error, which takes it out of the
          // sync. This one was not refused, so it goes back in as pending
          return this._store.storage.put(item)
            .pipe(
              map(() => item),
            );
        }),
        finalize(() => {
          this._sending.delete(key);
        }),
      );
  }

  public save(item: Data<T>): Observable<any> {
    return of(null)
      .pipe(
        switchMap(() => {
          item._sync = {
            ...item._sync,
            state: SyncState.Processing,
          };

          if (!item._sync.revision) {
            if (!this._post) {
              return this._store.storage.putError(item)
                .pipe(
                  switchMap(() => throwError('Remote post method not configured')),
                );
            }

            return this._post(item);
          }

          if (!this._put) {
            return this._store.storage.putError(item)
              .pipe(
                switchMap(() => throwError('Remote put method not configured')),
              );
          }

          return this._put(item)
            .pipe(
              catchError((error) => {
                return this._store.storage.putError(item)
                  .pipe(
                    switchMap(() => throwError(error)),
                  );
              }),
            );
        }),
        switchMap((response: Data<T>) => {
          return this._store.storage.putSynced(response);
        }),
      );
  }

  private _queueOnError(error: unknown): boolean {
    if (this._config.queueOnError) {
      return this._config.queueOnError(error);
    }

    if (error instanceof TimeoutError) {
      return true;
    }

    const status = (error as { status?: unknown })?.status;

    return status === 0 || (typeof status === 'number' && status >= 500);
  }

  private _getAllPages(): Observable<any[]> {
    return this._getPage([], 0);
  }

  private _getPage(data, offset): Observable<any[]> {
    const query = {
      modifyDate: this._modifyDate,
      limit: this._limit,
      offset,
    };

    return this._gets(query)
      .pipe(
        switchMap((pageData) => {
          data.push(...pageData);

          if (pageData.length < this._limit) {
            return of(data);
          }

          offset += this._limit;

          return this._getPage(data, offset);
        }),
      );
  }

}
