import { describe, expect, it } from 'vitest';

import { SyncState } from '../src/app/enums';
import {
  isErrored, isPending, isProcessing, isSynced, isUnsent, syncState,
} from '../src/app/helpers';


const record = (state?: SyncState) => (state ? { _sync: { state } } : {});


describe('sync state helpers', () => {
  // A record with no _sync was never written locally — Store.put stamps every
  // local write Pending — so it came from the server and counts as synced.
  it('treats a record with no sync state as synced', () => {
    expect(syncState({})).toBe(SyncState.Synced);
    expect(isSynced({})).toBe(true);
    expect(isUnsent({})).toBe(false);
  });

  it('reads the recorded state', () => {
    expect(syncState(record(SyncState.Pending))).toBe(SyncState.Pending);
    expect(syncState(record(SyncState.Error))).toBe(SyncState.Error);
  });

  it('isSynced is true only for synced records', () => {
    expect(isSynced(record(SyncState.Synced))).toBe(true);
    expect(isSynced(record(SyncState.Pending))).toBe(false);
    expect(isSynced(record(SyncState.Processing))).toBe(false);
    expect(isSynced(record(SyncState.Error))).toBe(false);
  });

  // The question that matters before discarding local data: every state the
  // server has not acknowledged must count as unsent, including Error and
  // Processing, or work gets deleted that exists nowhere else.
  it('isUnsent covers every state the server has not acknowledged', () => {
    expect(isUnsent(record(SyncState.Pending))).toBe(true);
    expect(isUnsent(record(SyncState.Processing))).toBe(true);
    expect(isUnsent(record(SyncState.Error))).toBe(true);
    expect(isUnsent(record(SyncState.Synced))).toBe(false);
  });

  it('narrows to a single state', () => {
    expect(isPending(record(SyncState.Pending))).toBe(true);
    expect(isPending(record(SyncState.Error))).toBe(false);

    expect(isProcessing(record(SyncState.Processing))).toBe(true);
    expect(isProcessing(record(SyncState.Pending))).toBe(false);

    expect(isErrored(record(SyncState.Error))).toBe(true);
    expect(isErrored(record(SyncState.Pending))).toBe(false);
  });

  it('tolerates a null record', () => {
    expect(isSynced(null)).toBe(true);
    expect(isUnsent(undefined)).toBe(false);
  });
});
