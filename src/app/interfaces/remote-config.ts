import { Observable } from 'rxjs';

import { Data } from './data';


export interface RemoteQuery {
  limit: number;
  offset: number;
  modifyDate: Date;
}

export interface RemoteConfig<T = any> {
  gets?: (query: RemoteQuery) => Observable<T[]>;
  put?: (data: Data<T>) => Observable<Data<T>>;
  post?: (data: Data<T>) => Observable<Data<T>>;
  limit?: number;
  /**
   * How long, in milliseconds, the send that put() makes straight away may take
   * before put() stops waiting and leaves the record pending for the next sync.
   * Off by default, because giving up on a request that may already have reached
   * the server means the next sync sends it again: only set this for endpoints
   * that answer a repeat with the record they already hold.
   */
  saveTimeout?: number;
  /**
   * Decides what a failed send from put() means. True: the record could not be
   * sent yet, so it stays pending for the next sync and put() completes. False:
   * the server refused it, so the error reaches the caller.
   *
   * By default a timeout, no answer at all (`status` 0) and a server fault
   * (`status` 5xx) could not be sent; anything else is a refusal.
   */
  queueOnError?: (error: unknown) => boolean;
}
