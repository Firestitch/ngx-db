import { IndexDbStorage, LocalStorage, MemoryStorage } from '../storage';

import { RemoteConfig } from './remote-config';
import { StoreIndex } from './store-index';

export interface StoreConfig {
  remote?: RemoteConfig;
  storage?: IndexDbStorage | LocalStorage | MemoryStorage;
  indexes?: StoreIndex[];
}
