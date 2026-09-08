import { RemoteConfig } from './remote-config';
import { StorageConfig } from './storage-config';
import { StoreIndex } from './store-index';

export interface StoreConfig<T = any> {
  remote?: RemoteConfig<T>;
  storage?: StorageConfig;
  indexes?: StoreIndex[];
}
