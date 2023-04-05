export function filter(fn) {
  return (data, index, length) => {
    return fn(data, index, length);
  };
}
