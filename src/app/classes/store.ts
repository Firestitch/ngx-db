import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { map, skip, take, takeUntil, tap } from 'rxjs/operators';

import { LocalStorageAdapter } from '../adapters/local-storage.adapter';


export class Store<T> {

  private _data$ = new BehaviorSubject<{ [key: string]: T }>({});
  private _adapter: LocalStorageAdapter;
  private _destroy$ = new Subject();

  constructor(
  ) {
    this._initAdapter();
  }

  public get name(): string {
    return this.constructor.name;
  }

  public get values$(): Observable<T[]> {
    return this._data$.asObservable()
      .pipe(
        map((data) => Object.values(data)),
      );
  }

  public get data(): { [key: string]: T } {
    return this._data$.getValue();
  }

  public get length(): number {
    return this.keys.length;
  }

  public get values(): T[] {
    return Object.values(this._data$.getValue());
  }

  public get keys(): string[] {
    return Object.keys(this._data$.getValue());
  }

  public delete(...operators: any): Observable<any> {
    let data = {};
    if(operators.length !== 0) {
      data = this.data;
      const length = this.length;

      Object.keys(data)
        .forEach((key, index) => {

          const every = operators.every((operator) => {
            return operator(data[key], index, length);
          });

          if(every) {
            delete data[key];
          }
        });
    }

    this._data$.next(data);

    return of(true);
  }

  public put(data: T): Observable<T> {
    const value: any = {
      ...this._data$.getValue(),
      [(data as any).id]: data,
    };

    return of(data)
      .pipe(
        tap(() => this._data$.next(value)),
      );
  }

  public get(id: string): Observable<T> {

    return of(this._data$.getValue()[id] || null);
  }

  public exists(id: string): Observable<boolean> {

    return of(id in this._data$.getValue());
  }

  public gets(...operators): Observable<T[]> {
    let values = this.values;

    if(operators.length !== 0) {
      const length = values.length;
      values = values.filter((item, index) => {
        return operators.every((operator) => {
          return operator(item, index, length);
        });
      });
    }

    return of(values);
  }

  public destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _initAdapter(): void {
    this._adapter = new LocalStorageAdapter(this);
    this._adapter.get()
      .pipe(
        take(1),
      )
      .subscribe((data) => {
        this._data$.next(data);
        this._initAdapterSave();
      });
  }

  private _initAdapterSave(): void {
    this._data$
      .pipe(
        skip(1),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this._adapter.save();
      });
  }

}
