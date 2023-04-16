import { RemoteConfig } from './remote-config';
import { StorageConfig } from './storage-config';
import { StoreIndex } from './store-index';

export interface StoreConfig {
  remote?: RemoteConfig;
  storage?: StorageConfig;
  indexes?: StoreIndex[];
}
