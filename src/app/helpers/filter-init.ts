export function filterInit(ob) {
  Object.defineProperty(ob, 'type', { value: 'filter' });

  return ob;
}
