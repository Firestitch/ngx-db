import { filterInit } from '../helpers';

export function first() {
  return filterInit((data, index, length) => {
    return index === 0;
  });
}
