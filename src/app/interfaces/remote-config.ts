import { Observable } from 'rxjs';


export interface RemoteConfig {
  gets: (query: any) => Observable<any[]>;
  put: (data: any) => Observable<any>;
  post: (data: any) => Observable<any>;
}

