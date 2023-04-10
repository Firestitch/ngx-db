import { Store } from '../classes';

export function mapOne(store: Store<any>, propertyName, referenceName, foreignReferenceName) {
  return Object.defineProperty(() => {
    return { store, propertyName, referenceName, foreignReferenceName };
  }, 'name', { value: 'mapOne' });
}
