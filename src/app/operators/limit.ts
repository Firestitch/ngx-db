export function limit(count, offset = 0) {
  return Object.defineProperty(() => {
    return { count, offset };
  }, 'type', { value: 'limit' });
}
