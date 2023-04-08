export function mapOne(store, propertyName, referenceName, foreignReferenceName) {
  return Object.defineProperty(() => {
    return { store, propertyName, referenceName, foreignReferenceName };
  }, 'name', { value: 'mapOne' });
}
