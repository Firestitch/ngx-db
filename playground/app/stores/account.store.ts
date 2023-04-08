import { Store } from '@firestitch/db';

export class AccountStore extends Store<UnitType> {

  protected _keyName = 'id';

}

interface UnitType {
  id?: string;
}
