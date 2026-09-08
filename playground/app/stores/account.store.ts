import { Store } from '@firestitch/db';

export class AccountStore extends Store<Country> {

  public static storeName = 'country';
  public static keyName = 'id';

}

export interface Country {
  id?: number;
  country?: string;
  regionId?: number;
  population?: number;
  date?: string | Date;
}
