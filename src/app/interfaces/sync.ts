import { SyncState } from '../enums';

export interface Sync {
  revision?: number;
  state?: SyncState;
  date?: Date;
}

