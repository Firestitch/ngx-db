import { Store } from '@firestitch/db';

export class BuildingStore extends Store<Building> {

  protected _keyName = 'id';
  protected _revisionName = 'revision';

}

interface Building {
  id?: string;
  floors?: any[];
}
