import { Observable } from 'rxjs';

import { IndexDbStorage, LocalStorage, MemoryStorage } from '../storage';

export interface StoreConfig {
  remote?: RemoteConfig;
  storage?: IndexDbStorage | LocalStorage | MemoryStorage;
}


export interface RemoteConfig {
  gets: (query: any) => Observable<any[]>;
  put: (data: any) => Observable<any>;
}

