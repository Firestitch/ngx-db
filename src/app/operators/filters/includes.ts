import { filterInit } from '../../helpers';

export function includes(name, values) {
  return filterInit((data) => {
    return values.includes(data[name]);
  });
}
