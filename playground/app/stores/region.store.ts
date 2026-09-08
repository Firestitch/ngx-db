import { Store } from '@firestitch/db';

export class RegionStore extends Store<Region> {

  public static storeName = 'region';
  public static keyName = 'id';

}

export interface Region {
  id?: number;
  name?: string;
}
