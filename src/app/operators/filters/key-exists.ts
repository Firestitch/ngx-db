import { filterInit } from '../../helpers';

export function keyExists(key) {
  return filterInit((data): boolean => {
    return key in data;
  });
}
