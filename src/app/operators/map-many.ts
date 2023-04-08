export function mapMany(store, propertyName, referenceName, foreignReferenceName) {
  return Object.defineProperty(() => {
    return { store, propertyName, referenceName, foreignReferenceName };
  }, 'name', { value: 'mapMany' });
}
