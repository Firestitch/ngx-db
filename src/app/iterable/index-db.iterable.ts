import { parse } from '@firestitch/date';

import { Observable, Subscriber, combineLatest, of } from 'rxjs';
import { map, mapTo, switchMap, tap } from 'rxjs/operators';

import { MapOneOperator, Operator } from '../types';
import { includes } from '../operators';
import { OperatorData } from '../classes';

export class IndexDbIterable {

  private _data = [];

  constructor(
    private _db: IDBDatabase,
    private _store: string,
    private _operatorData: OperatorData,
  ) {
  }

  public get data$(): Observable<any> {
    const transaction = this._db.transaction(this._store, 'readonly');
    const objectStore = transaction.objectStore(this._store);

    const keySortOperator = this._operatorData.sortOperators
      .find((operator: any) => {
        return objectStore.indexNames.contains(operator().name);
      });

    let cursor: IDBObjectStore | IDBIndex = objectStore;
    if(keySortOperator) {
      const keySortConfig = keySortOperator();
      cursor = objectStore.index(keySortConfig.name);
    }

    return new Observable((observer: Subscriber<any>) => {
      const request = cursor.openCursor();
      let index = 0;

      request.onsuccess = (event: any) => {
        if(!event.target.result) {
          return this._complete(observer);
        }

        const value = event.target.result.value;
        const match = this._operatorData.match(value, index);

        if(match) {
          if(!this._operatorData.limit || index >= this._operatorData.limit.offset) {
            this._data.push(value);
          }

          index++;
        }

        if(
          this._operatorData.limit &&
          this._operatorData.limit.count === index - this._operatorData.limit.offset
        ) {
          return this._complete(observer);
        }

        event.target.result.continue();
      };

      request.onerror = () => {
        observer.error();
      };
    })
      .pipe(
        tap(() => this._sort(keySortOperator)),
        switchMap(() => this._map()),
        map(() => this._data),
      );
  }

  private _sort(keySortOperator) {
    const sortOperators = this._operatorData.sortOperators
      .filter((operator: any) => {
        return keySortOperator !== operator;
      });

    if(sortOperators.length) {
      sortOperators.forEach((sortOperator) => {
        const sortOperatorConfig = sortOperator();
        this._data = this._data
          .sort((o1, o2) => {
            if(sortOperatorConfig.type === 'numeric') {
              return o1[sortOperatorConfig.name] - o2[sortOperatorConfig.name];
            }

            if(sortOperatorConfig.type === 'date') {
              return parse(o1[sortOperatorConfig.name]).getTime() - parse(o2[sortOperatorConfig.name]).getTime();
            }
            const v1 = String(o1[sortOperatorConfig.name] || '');
            const v2 = String(o2[sortOperatorConfig.name] || '');

            return v1.localeCompare(v2);
          });

        if(sortOperatorConfig.direction === 'desc') {
          this._data.reverse();
        }
      });
    }
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

