import { Store } from '@firestitch/db';

export class BuildingStore extends Store<Building> {
  public getFloors() {

  }
}

interface Building {
  id?: string;
  floors?: any[];
}
