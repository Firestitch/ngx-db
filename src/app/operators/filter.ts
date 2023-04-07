import { filterInit } from '../helpers';

export function filter(fn) {
  return filterInit(
    (data, index, length) => {
      return fn(data, index, length);
    },
  );
}
