import { describe, expect, it } from 'vitest';

import { OperatorData } from '../src/app/classes/operator-data';
import {
  eq, filter, includes, keyExists, limit, match, not, or, sort, sortDate, sortNumber,
} from '../src/app/operators';


describe('filter operators', () => {

  describe('eq', () => {
    it('matches strict equality', () => {
      expect(eq('country', 'Canada')({ country: 'Canada' })).toBe(true);
      expect(eq('country', 'Sweden')({ country: 'Canada' })).toBe(false);
    });

    it('is strict, so it does not coerce types', () => {
      expect(eq('areaId', 3)({ areaId: '3' })).toBe(false);
    });

    it('handles a missing key', () => {
      expect(eq('missing', 'x')({})).toBe(false);
    });

    it('matches an explicit undefined value', () => {
      expect(eq('a', undefined)({})).toBe(true);
    });
  });

  describe('includes', () => {
    it('matches when the value is in the list', () => {
      expect(includes('areaId', [1, 2, 3])({ areaId: 2 })).toBe(true);
      expect(includes('areaId', [1, 2, 3])({ areaId: 9 })).toBe(false);
    });

    it('returns false for an empty list', () => {
      expect(includes('areaId', [])({ areaId: 1 })).toBe(false);
    });
  });

  describe('keyExists', () => {
    it('detects presence of the key, not truthiness', () => {
      expect(keyExists('a')({ a: undefined })).toBe(true);
      expect(keyExists('a')({ a: null })).toBe(true);
      expect(keyExists('a')({ b: 1 })).toBe(false);
    });
  });

  describe('match', () => {
    it('matches a regular expression', () => {
      expect(match('country', /Can/)({ country: 'Canada' })).toBe(true);
      expect(match('country', /Xyz/)({ country: 'Canada' })).toBe(false);
    });

    it('matches a string expression', () => {
      expect(match('country', 'nad')({ country: 'Canada' })).toBe(true);
    });

    it('honours regex flags', () => {
      expect(match('country', 'sweden', 'i')({ country: 'Sweden' })).toBe(true);
      expect(match('country', 'sweden')({ country: 'Sweden' })).toBe(false);
    });

    it('stringifies non-string values', () => {
      expect(match('areaId', '3')({ areaId: 3 })).toBe(true);
    });

    it('stringifies null/undefined rather than throwing', () => {
      expect(match('a', 'null')({ a: null })).toBe(true);
      expect(match('a', 'undefined')({})).toBe(true);
    });
  });

  describe('not', () => {
    it('negates the wrapped predicate', () => {
      expect(not(eq('country', 'Canada'))({ country: 'Canada' })).toBe(false);
      expect(not(eq('country', 'Canada'))({ country: 'Sweden' })).toBe(true);
    });
  });

  describe('or', () => {
    it('is true when any operand matches', () => {
      const op = or(match('country', /Canada/), eq('areaId', 3));

      expect(op({ country: 'Canada', areaId: 1 })).toBe(true);
      expect(op({ country: 'Sweden', areaId: 3 })).toBe(true);
      expect(op({ country: 'Sweden', areaId: 1 })).toBe(false);
    });

    it('is false with no operands', () => {
      expect(or()({ a: 1 })).toBe(false);
    });
  });

  describe('filter', () => {
    it('delegates to the supplied predicate', () => {
      expect(filter((data) => data.n > 2)({ n: 3 })).toBe(true);
      expect(filter((data) => data.n > 2)({ n: 1 })).toBe(false);
    });
  });

  it('tags every filter operator with type "filter"', () => {
    [
      eq('a', 1),
      includes('a', [1]),
      keyExists('a'),
      match('a', /x/),
      not(() => true),
      or(),
      filter(() => true),
    ].forEach((operator: any) => {
      expect(operator.type).toBe('filter');
    });
  });
});


describe('limit operator', () => {
  it('is tagged and reports count/offset', () => {
    const op: any = limit(2, 4);

    expect(op.type).toBe('limit');
    expect(op()).toEqual({ count: 2, offset: 4 });
  });

  it('defaults offset to 0', () => {
    expect((limit(5) as any)()).toEqual({ count: 5, offset: 0 });
  });
});


describe('sort operators', () => {
  it('is tagged and defaults direction, nulls and type', () => {
    const op: any = sort('country');

    expect(op.type).toBe('sort');
    expect(op()).toEqual({
      name: 'country',
      direction: 'asc',
      options: { nulls: 'first', type: 'string' },
    });
  });

  it('sortNumber and sortDate set their type', () => {
    expect((sortNumber('areaId') as any)().options.type).toBe('number');
    expect((sortDate('date') as any)().options.type).toBe('date');
  });

  it('preserves an explicit nulls option', () => {
    expect((sortDate('date', 'asc', { nulls: 'last' }) as any)().options.nulls).toBe('last');
  });
});


describe('OperatorData', () => {
  it('separates filters, sorts and limit', () => {
    const operatorData = new OperatorData([
      eq('country', 'Canada'),
      sort('country'),
      limit(2, 1),
    ]);

    expect(operatorData.limit).toEqual({ count: 2, offset: 1 });
    expect(operatorData.sortOperators.length).toBe(1);
  });

  it('matches only when every filter passes (AND semantics)', () => {
    const operatorData = new OperatorData([
      eq('country', 'Canada'),
      eq('areaId', 1),
    ]);

    expect(operatorData.match({ country: 'Canada', areaId: 1 })).toBe(true);
    expect(operatorData.match({ country: 'Canada', areaId: 2 })).toBe(false);
  });

  it('matches everything when no filters are supplied', () => {
    expect(new OperatorData([]).match({ anything: true })).toBe(true);
  });

  it('reports a null limit when none is supplied', () => {
    expect(new OperatorData([]).limit).toBeNull();
  });
});
