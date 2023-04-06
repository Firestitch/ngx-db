import { Store } from '@firestitch/db';

export class UnitTypeStore extends Store<UnitType> {
}

interface UnitType {
  id?: string;
}
