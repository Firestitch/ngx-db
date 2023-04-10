import { filterInit } from '../../helpers';

export function not(fn) {
  return filterInit((data) => {
    return !fn(data);
  });
}
