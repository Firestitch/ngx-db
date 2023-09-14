import { Store } from '@firestitch/db';

export class FileStore extends Store<FileItem> {

  public static storeName = 'file';
  public static keyName = 'guid';

}

interface FileItem {
  guid?: string;
  file?: File;
}
