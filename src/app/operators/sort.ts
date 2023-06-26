export function sort(
  name: string,
  type: 'alphanumeric' | 'numeric' | 'date' = 'alphanumeric',
  direction: 'desc' | 'asc' = 'asc',
  options?: { nulls?: 'first' | 'last' },
) {
  return Object.defineProperty(() => {
    options = {
      ...options,
      nulls: options?.nulls ?? 'first',
    };

    return { name, type, direction, options };
  }, 'type', { value: 'sort' });
}
