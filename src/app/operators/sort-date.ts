import { sort } from './sort';

export function sortDate(
  name: string,
  direction: 'desc' | 'asc' = 'asc',
  options?: { nulls?: 'first' | 'last' },
) {
  return sort(name, direction, {
    ...options,
    type: 'date',
  });
}
