import { Remote } from '../classes';
import { IndexDbStorage, LocalStorage, MemoryStorage } from '../storage';

export interface StoreConfig {
  remote?: Remote;
  storage?: IndexDbStorage | LocalStorage | MemoryStorage;
}

