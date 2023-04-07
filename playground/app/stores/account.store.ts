import { Store } from '@firestitch/db';

export class AccountStore extends Store<UnitType> {
}

interface UnitType {
  id?: string;
}
