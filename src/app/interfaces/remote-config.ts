import { Observable } from 'rxjs';

import { Data } from './data';


export interface RemoteQuery {
  limit: number;
  offset: number;
  modifyDate: Date;
}

export interface RemoteConfig<T = any> {
  gets?: (query: RemoteQuery) => Observable<T[]>;
  put?: (data: Data<T>) => Observable<Data<T>>;
  post?: (data: Data<T>) => Observable<Data<T>>;
  limit?: number;
}
