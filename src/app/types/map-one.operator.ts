import { Store } from '../classes';

export interface MapOneOperator {
  store: Store<any>;
  propertyName: string;
  referenceName: string;
  foreignReferenceName: string;
}
