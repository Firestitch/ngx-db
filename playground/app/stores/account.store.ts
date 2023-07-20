import { Store } from '@firestitch/db';

export class AccountStore extends Store<UnitType> {

  public static storeName = 'account';
  public static keyName = 'id';

}

interface UnitType {
  id?: string;
}
