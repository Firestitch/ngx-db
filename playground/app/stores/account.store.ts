import { Store } from '@firestitch/db';

export class AccountStore extends Store<UnitType> {

  protected _name = 'account';
  protected _keyName = 'id';
  protected _revisionName = 'revision';

}

interface UnitType {
  id?: string;
}
