export function eq(name, value) {
  return (data) => {
    return data[name] === value;
  };
}
