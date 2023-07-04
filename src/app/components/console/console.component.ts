import { Component, ChangeDetectionStrategy } from '@angular/core';

import { FsMessage } from '@firestitch/message';
import { FsPrompt } from '@firestitch/prompt';

import { switchMap } from 'rxjs/operators';

import { FsDb } from '../../services';


@Component({
  selector: 'fs-db-console',
  templateUrl: './console.component.html',
  styleUrls: ['./console.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleComponent {

  constructor(
    private _db: FsDb,
    private _message: FsMessage,
    private _prompt: FsPrompt,
  ) {
  }

  public startSync(): void {
    this._prompt.input({
      title: 'Sync start',
      label: 'Run the sync process every x seconds?',
      required: true,
    })
      .pipe(
        switchMap((seconds) => this._db.startSync(seconds),
        ),
      )
      .subscribe(() => {
        this._message.success('Started Sync');
      });
  }

  public stopSync(): void {
    this._db.stopSync();
    this._message.success('Stopped Sync');
  }

}
