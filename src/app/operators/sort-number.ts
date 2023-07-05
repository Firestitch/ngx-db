import { sort } from './sort';

export function sortNumber(
  name: string,
  direction: 'desc' | 'asc' = 'asc',
  options?: { nulls?: 'first' | 'last' },
) {
  return sort(name, direction, {
    ...options,
    type: 'number',
  });
}
