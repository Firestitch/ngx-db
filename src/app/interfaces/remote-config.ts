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
   *
   * Off by default, and only safe to set on an endpoint that is idempotent.
   * Timing out does not cancel the request: it may already have reached the
   * server and been committed, and the answer merely lost on the way back. The
   * record is still pending, so the next sync sends it again. On an endpoint
   * that creates a new record per request, that is a duplicate on the server,
   * and nothing on the client can see it happen. Set this only where a repeat
   * is answered with the record the server already holds, keyed on something
   * the client generates.
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
