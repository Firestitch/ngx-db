import { SyncState } from '../enums';

export const SyncStates = [
  { name: 'Pending', value: SyncState.Pending },
  { name: 'Processing', value: SyncState.Processing },
  { name: 'Error', value: SyncState.Error },
  { name: 'Synced', value: SyncState.Synced },
];
