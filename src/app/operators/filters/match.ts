import { filterInit } from '../../helpers';

export function match(name, expression, flags?) {
  return filterInit((data) => {
    return String(data[name]).match(new RegExp(expression, flags)) !== null;
  });
}
