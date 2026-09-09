import { SyncState } from '../enums';
import { Data } from '../interfaces';


/**
 * Questions about a record's sync state.
 *
 * These exist so consumers never reach into `_sync` themselves. Sync state is
 * metadata the library maintains about a record, not part of the record, and
 * keeping the questions here means the rules live beside the code that sets
 * them rather than being re-derived at each call site.
 *
 * They are plain functions rather than methods on the record because records
 * are structured-cloned in and out of storage: anything attached to a row is
 * lost on the way through, and a class instance cannot be written back at all.
 */

/**
 * The state the library has recorded for this record, or Synced when it has
 * none.
 *
 * A record with no sync state was never written locally — `Store.put()` stamps
 * every local write as Pending — so it came from the server and is by
 * definition already in step with it.
 */
export function syncState(record: Data<any>): SyncState {
  return record?._sync?.state || SyncState.Synced;
}

/**
 * The server has this record. Nothing is waiting to go up for it.
 */
export function isSynced(record: Data<any>): boolean {
  return syncState(record) === SyncState.Synced;
}

/**
 * The server does not have this record, or does not have the latest version of
 * it: it is queued, in flight, or failed on its last attempt.
 *
 * This is the question to ask before discarding local data. Deleting a record
 * that is not synced loses work that exists nowhere else.
 */
export function isUnsent(record: Data<any>): boolean {
  return !isSynced(record);
}

/**
 * Waiting for the next sync to pick it up.
 */
export function isPending(record: Data<any>): boolean {
  return syncState(record) === SyncState.Pending;
}

/**
 * Handed to the server, with no answer yet.
 */
export function isProcessing(record: Data<any>): boolean {
  return syncState(record) === SyncState.Processing;
}

/**
 * The last attempt to send it failed.
 */
export function isErrored(record: Data<any>): boolean {
  return syncState(record) === SyncState.Error;
}
