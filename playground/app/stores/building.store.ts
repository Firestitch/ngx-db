import { Store } from '@firestitch/db';

export class BuildingStore extends Store<Building> {

  public static storeName = 'account';
  public static keyName = 'id';

}

interface Building {
  id?: string;
  floors?: any[];
}
