import { toString } from '@firestitch/common';
import { parse } from '@firestitch/date';

import { Observable, Subscriber, combineLatest, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { includes } from '../operators';
import { MapOneOperator, Operator } from '../types';

import { OperatorData } from '.';

export class IndexDbData {

  private _data = [];
  private _transaction: IDBTransaction;
  private _objectStore: IDBObjectStore;

  constructor(
    private _db: IDBDatabase,
    private _store: string,
    private _operatorData: OperatorData,
  ) {
    this._transaction = this._db.transaction(this._store, 'readonly');
    this._objectStore = this._transaction.objectStore(this._store);
  }

  public get sortOperators(): Operator[] {
    return this._operatorData.sortOperators
      .filter((operator: any) => {
        return !this._objectStore.indexNames.contains(operator().name);
      });
  }

  public get keySortOperator(): Operator {
    return this._operatorData.sortOperators
      .find((operator: any) => {
        return this._objectStore.indexNames.contains(operator().name);
      });
  }

  public get data$(): Observable<any> {
    const keySortOperator = this.keySortOperator;

    let cursor: IDBObjectStore | IDBIndex = this._objectStore;
    if (keySortOperator) {
      const keySortConfig = keySortOperator();
      cursor = this._objectStore.index(keySortConfig.name);
    }

    return new Observable((observer: Subscriber<any>) => {
      const request = cursor.openCursor();
      let index = 0;

      request.onsuccess = (event: any) => {
        if (!event.target.result) {
          return this._complete(observer);
        }

        const value = event.target.result.value;
        const match = this._operatorData.match(value);

        if (match) {
          this._data.push(value);
          index++;
        }

        event.target.result.continue();
      };

      request.onerror = () => {
        observer.error();
      };
    })
      .pipe(
        tap(() => this._sort()),
        tap(() => this._limit()),
        switchMap(() => this._map()),
        map(() => this._data),
      );
  }

  private _limit(): void {
    if (!this._operatorData.limit) {
      return;
    }

    const offset = this._operatorData.limit.offset;
    this._data = this._data.slice(offset, offset + this._operatorData.limit.count);
  }

  private _sort(): void {
    const sortOperators = this.sortOperators;

    if (sortOperators.length) {
      sortOperators.forEach((sortOperator) => {
        const sortOperatorConfig = sortOperator();
        this._data = this._data
          .sort((o1, o2) => {
            const v1 = this._getData(o1, sortOperatorConfig.name) ?? null;
            const v2 = this._getData(o2, sortOperatorConfig.name) ?? null;

            if (sortOperatorConfig.options.type === 'number') {
              return v1 - v2;
            }

            if (sortOperatorConfig.options.type === 'date') {
              let d1 = typeof v1 === 'string' ? parse(v1) : v1;
              let d2 = typeof v2 === 'string' ? parse(v2) : v2;

              if (sortOperatorConfig.options.nulls === 'last') {
                d1 = d1 === null ? new Date(9999, 1, 1) : d1;
                d2 = d2 === null ? new Date(9999, 1, 1) : d2;
              }

              const t1 = d1 ? d1.getTime() : 0;
              const t2 = d2 ? d2.getTime() : 0;

              return t1 > t2 ? 1 : -1;
            }

            return toString(v1).localeCompare(toString(v2));
          });

        if (sortOperatorConfig.direction === 'desc') {
          this._data.reverse();
        }
      });
    }
  }

  private _getData(object, keys): any {
    object = object || {};

    if (typeof (keys) === 'string') {
      return object[keys];
    }

    if (Array.isArray(keys)) {
      if (keys.length === 1) {
        return object[keys[0]];
      }

      keys = [...keys];
      const key = keys.shift();

      return this._getData(object[key], keys);
    }

    return undefined;
  }

  private _map(): Observable<any> {
    const mapOperators = this._operatorData.mapOneOperators
      .map((operator: () => MapOneOperator) => {
        return this._mapOne(operator());
      })
      .filter((value) => !!value);

    return mapOperators.length ? combineLatest(...mapOperators) : of(this._data);
  }

  private _complete(observer) {
    observer.next(this._data);
    observer.complete();
  }

  private _mapOne(mapOne: MapOneOperator): Observable<any> {
    const references = [
      ...new Set(this._data
        .map((item) => item[mapOne.referenceName])),
    ]
      .filter((item) => !!item);

    return (mapOne.store).gets(
      includes(mapOne.foreignReferenceName, references),
    )
      .pipe(
        tap((data) => {
          data = data
            .reduce((accum, item) => {
              return {
                ...accum,
                [item[mapOne.foreignReferenceName]]: item,
              };
            }, {});

          this._data
            .forEach((item) => {
              const key = item[mapOne.referenceName];
              item[mapOne.propertyName] = data[key];
            });
        }),
      );

  }

}

