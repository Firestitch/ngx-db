export interface DestroyOptions {
  /**
   * Keep every record that has not reached the server — any `_sync.state` other than
   * `synced`. Only synced records are deleted and the object store itself survives, so
   * the next `sync()` pushes the surviving records as normal.
   *
   * Defaults to false: the store is deleted outright, exactly as before.
   */
  preserveUnsynced?: boolean;
}
