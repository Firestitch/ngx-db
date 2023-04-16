import { Store } from '@firestitch/db';

export class FileStore extends Store<FileItem> {

  protected _keyName = 'guid';
  protected _revisionName = 'revision';

}

interface FileItem {
  guid?: string;
  file?: File;
}
