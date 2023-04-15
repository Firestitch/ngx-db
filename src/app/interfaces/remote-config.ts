import { Observable } from 'rxjs';


export interface RemoteConfig {
  gets?: (query: { limit: number; offset: number }) => Observable<any[]>;
  put?: (data: any) => Observable<any>;
  post?: (data: any) => Observable<any>;
  limit?: number;
}

