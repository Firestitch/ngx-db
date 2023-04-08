import { Store } from '@firestitch/db';

export class BuildingStore extends Store<Building> {

  protected _keyName = 'id';

  public getFloors() {

  }
}

interface Building {
  id?: string;
  floors?: any[];
}
