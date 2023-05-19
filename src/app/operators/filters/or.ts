import { filterInit } from '../../helpers';

export function or(...operators) {
  return filterInit((data) => {
    return operators.some((operator) => {
      return operator(data);
    });
  });
}
