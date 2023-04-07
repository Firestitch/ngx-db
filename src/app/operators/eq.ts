import { filterInit } from '../helpers';

export function eq(name, value) {
  return filterInit((data) => {
    return data[name] === value;
  });
}
