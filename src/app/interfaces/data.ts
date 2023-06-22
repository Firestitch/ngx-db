import { SyncState } from '../enums';

export type Data<T> = T & {
  _sync?: {
    date?: Date;
    revision?: number;
    message?: string;
    state?: SyncState;
  };
};
