export function last() {
  return (data, index, length) => {
    return index === length - 1;
  };
}
