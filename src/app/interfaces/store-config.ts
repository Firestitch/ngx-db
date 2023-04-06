import { Remote } from '../classes';
import { IndexDbStorage, LocalStorage, MemoryStorage } from '../storage';

export interface StoreConfig {
  keyName?: string;
  remote?: Remote;
  storage?: IndexDbStorage | LocalStorage | MemoryStorage;
}

