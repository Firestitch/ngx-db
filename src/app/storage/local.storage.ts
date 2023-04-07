import { Observable, Subject, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Store } from '../classes';

import { Storage } from './storage';


export class LocalStorage extends Storage {

  constructor(
    private _store: Store<any>,
  ) {
    super();
  }

  public gets(operators: any[]): Observable<any> {
    return of(null);
  }

  public clear(): Observable<void> {
    this._setItem({});

    return of(null);
  }

  public delete(keys: string[]): Observable<void> {
    return this.data
      .pipe(
        map((data) => {
          keys.forEach((key) => {
            delete data[key];
          });

          this._setItem(data);

          return null;
        }),
      );
  }

  public get(key: string): Observable<any> {
    return this.data
      .pipe(
        map((data) => data[key] || null),
      );
  }

  public put(value): Observable<void> {
    return this.data
      .pipe(
        switchMap((data) =>{
          if(Array.isArray(value)) {
            value.forEach((item) => {
              data = {
                ...data,
                [item[this._store.config.keyName]]: {
                  ...item,
                },
              };
            });
          } else {
            data = {
              ...data,
              [value[this._store.config.keyName]]: {
                ...value,
              },
            };
          }

          this._setItem(data);

          return of(null);
        }),
      );
  }

  public get data(): Observable<{ [key: string]: any}> {
    const data = JSON.parse(localStorage.getItem(this._store.name));

    return of(data);
  }

  public init(): Observable<void> {
    return of(null);
  }

  public open(): Observable<void> {
    return of(null);
  }

  private _setItem(data): void {
    localStorage.setItem(this._store.name, JSON.stringify(data));
  }

}
