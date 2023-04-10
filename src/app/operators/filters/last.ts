import { filterInit } from '../../helpers';

export function last() {
  return filterInit((data, index, length) => {
    return index === length - 1;
  });
}
