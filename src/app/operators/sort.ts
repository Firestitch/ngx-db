export function sort(
  name: string,
  type: 'alphanumeric' | 'numeric' | 'date' = 'alphanumeric',
  direction: 'desc' | 'asc' = 'asc',
) {
  return Object.defineProperty(() => {
    return { name, type, direction };
  }, 'type', { value: 'sort' });
}
