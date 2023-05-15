import { SyncState } from '../enums';

export type Data<T> = {
  _sync?: {
    date: Date;
    revision: number;
    message?: string;
    state: SyncState;
  };
} & T;
