export function sort(
  name: string | string[],
  direction: 'desc' | 'asc' = 'asc',
  options?: { nulls?: 'first' | 'last'; type?: 'string' | 'number' | 'date' },
) {
  return Object.defineProperty(() => {
    options = {
      ...options,
      nulls: options?.nulls ?? 'first',
      type: options?.type || 'string',
    };

    return { name, direction, options };
  }, 'type', { value: 'sort' });
}
