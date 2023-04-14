import { parse } from '@firestitch/date';

import { Observable, Subscriber, combineLatest, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { MapOneOperator, Operator } from '../types';
import { includes } from '../operators';

export class IndexDbIterable {

  private _data = [];
  private _filters = [];
  private _limit: {
    offset: number;
    limit: number;
    count: number;
  };

  constructor(
    private _db: IDBDatabase,
    private _store: string,
    private _operators: Operator[],
  ) {
    const limitOperator = this._operators
      .find((operator: Operator) => (operator as any).type === 'limit');

    this._limit = limitOperator ? limitOperator() : null;
    this._filters = this._operators
      .filter((operator: any) => {
        return operator.type === 'filter';
      });
  }

  public get data$(): Observable<any> {
    const transaction = this._db.transaction(this._store, 'readonly');
    const objectStore = transaction.objectStore(this._store);

    const keySortOperator = this._operators
      .find((operator: any) => {
        return operator.type === 'sort' && objectStore.indexNames.contains(operator().name);
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

        const match = this._filters.length === 0 ||
          this._filters.every((operator: Operator) => {
            return operator(value, index, length);
          });

        if(match) {
          if(!this._limit || index >= this._limit.offset) {
            this._data.push(value);
          }

          index++;
        }

        if(this._limit && this._limit.count === index - this._limit.offset) {
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
    const sortOperators = this._operators
      .filter((operator: any) => {
        return operator.type === 'sort' && keySortOperator !== operator;
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
    const mapOperators = this._operators
      .map((operator: () => MapOneOperator) => {
        switch(operator.name) {
          case 'mapOne':
            return this._mapOne(operator());
          // case 'mapMany':
          //   return this._mapMany(operator());
        }

        return null;
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

  // private _mapMany(mapOne: MapOneOperator): Observable<any> {
  //   const references = [
  //     ...new Set(this._data
  //       .map((item) => item[mapOne.referenceName])),
  //   ]
  //     .filter((item) => !!item);

  //   return (mapOne.store).gets(
  //     includes(mapOne.foreignReferenceName, references),
  //   )
  //     .pipe(
  //       tap((data) => {
  //         data = data
  //           .reduce((accum, item) => {
  //             return {
  //               ...accum,
  //               [item[mapOne.foreignReferenceName]]: item,
  //             };
  //           }, {});

  //         this._data
  //           .forEach((item) => {
  //             const key = item[mapOne.referenceName];
  //             item[mapOne.propertyName] = data[key];
  //           });


  //         // } else if(mapOperator.type === 'mapMany') {
  //         //   data = data
  //         //     .reduce((accum, item) => {
  //         //       return {
  //         //         ...accum,
  //         //         [item[mapConfig.foreignReferenceName]]: item,
  //         //       };
  //         //     }, {});

  //         //   this._data
  //         //     .forEach((item) => {
  //         //       const key = item[mapConfig.referenceName];
  //         //       item[mapConfig.propertyName] = data[key];
  //         //     });
  //         // }
  //       }),
  //     );

  // }
}

