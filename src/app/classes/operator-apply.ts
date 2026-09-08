import { toString } from '@firestitch/common';
import { parse } from '@firestitch/date';

import { Observable, combineLatest, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { includes } from '../operators';
import { MapOneOperator, Operator } from '../types';

import { OperatorData } from './operator-data';


// Sorting, limiting and mapping are storage-agnostic: they run over a plain array
// once the records have been read. Keeping them here lets every Storage backend
// share one implementation, so `sort`/`limit`/`mapOne` behave identically whether
// the data came from IndexedDB or memory.

export function getValue(object: any, keys: string | string[]): any {
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

    return getValue(object[key], keys);
  }

  return undefined;
}

export function applySort(data: any[], sortOperators: Operator[]): any[] {
  sortOperators
    .forEach((sortOperator) => {
      const config = sortOperator();

      data.sort((o1, o2) => {
        const v1 = getValue(o1, config.name) ?? null;
        const v2 = getValue(o2, config.name) ?? null;

        if (config.options.type === 'number') {
          return v1 - v2;
        }

        if (config.options.type === 'date') {
          let d1 = typeof v1 === 'string' ? parse(v1) : v1;
          let d2 = typeof v2 === 'string' ? parse(v2) : v2;

          if (config.options.nulls === 'last') {
            d1 = d1 === null ? new Date(9999, 1, 1) : d1;
            d2 = d2 === null ? new Date(9999, 1, 1) : d2;
          }

          const t1 = d1 ? d1.getTime() : 0;
          const t2 = d2 ? d2.getTime() : 0;

          return t1 > t2 ? 1 : -1;
        }

        return toString(v1).localeCompare(toString(v2));
      });

      if (config.direction === 'desc') {
        data.reverse();
      }
    });

  return data;
}

export function applyLimit(data: any[], operatorData: OperatorData): any[] {
  if (!operatorData.limit) {
    return data;
  }

  const offset = operatorData.limit.offset;

  return data.slice(offset, offset + operatorData.limit.count);
}

export function applyMap(data: any[], operatorData: OperatorData): Observable<any[]> {
  const mapOperators = [
    ...operatorData.mapOneOperators
      .map((operator: () => MapOneOperator) => mapOne(data, operator())),
    ...operatorData.mapManyOperators
      .map((operator: () => MapOneOperator) => mapMany(data, operator())),
  ];

  return mapOperators.length
    ? combineLatest(mapOperators)
      .pipe(
        map(() => data),
      )
    : of(data);
}

function references(data: any[], referenceName: string): any[] {
  return [
    ...new Set(data.map((item) => item[referenceName])),
  ]
    .filter((item) => !!item);
}

function mapOne(data: any[], operator: MapOneOperator): Observable<any> {
  return operator.store
    .gets(includes(operator.foreignReferenceName, references(data, operator.referenceName)))
    .pipe(
      tap((foreignData: any[]) => {
        const indexed = foreignData
          .reduce((accum, item) => {
            return {
              ...accum,
              [item[operator.foreignReferenceName]]: item,
            };
          }, {});

        data.forEach((item) => {
          item[operator.propertyName] = indexed[item[operator.referenceName]];
        });
      }),
    );
}

function mapMany(data: any[], operator: MapOneOperator): Observable<any> {
  return operator.store
    .gets(includes(operator.foreignReferenceName, references(data, operator.referenceName)))
    .pipe(
      tap((foreignData: any[]) => {
        const grouped = foreignData
          .reduce((accum, item) => {
            const key = item[operator.foreignReferenceName];

            return {
              ...accum,
              [key]: [...(accum[key] || []), item],
            };
          }, {});

        data.forEach((item) => {
          item[operator.propertyName] = grouped[item[operator.referenceName]] || [];
        });
      }),
    );
}
