import { Injectable } from '@angular/core';

import { Store } from '../classes';


@Injectable({
  providedIn: 'root',
})
export class FsDb {

  // constructor(
  //   // Custom interceptors
  //   @Optional() @Inject(FS_TRANSFER_HANDLER) private handler: FsDbHandler,
  // ) {
  // }

  private _stores = new Map<string,Store<any>>();

  public registerStore(store: Store<any>) {
    this._stores.set(store.constructor.name, store);
  }

  public store(store): Store<any> {
    return this._stores.get(store.name);
  }

}
