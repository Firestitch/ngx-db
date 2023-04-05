import { Observable } from 'rxjs';

export interface StorageAdapter {
  save: () => Observable<any>;
  get: () => Observable<{ [key: string]: any}>;
}
