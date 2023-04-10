import { IndexDbStorage, LocalStorage, MemoryStorage } from '../storage';

import { RemoteConfig } from './remote-config';

export interface StoreConfig {
  remote?: RemoteConfig;
  storage?: IndexDbStorage | LocalStorage | MemoryStorage;
}
