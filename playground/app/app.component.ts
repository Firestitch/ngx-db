import { Component } from '@angular/core';
import { environment } from '../environments/environment';
import { FsExampleModule } from '@firestitch/example';
import { ConsoleComponent } from '../../src/app/components/console/console.component';
import { GetComponent } from './components/get/get.component';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    standalone: true,
    imports: [FsExampleModule, ConsoleComponent, GetComponent]
})
export class AppComponent {

  public config = environment;

  public handlerCode = `import { FsDbHandler } from '@firestitch/db';
import { FsMessage } from '@firestitch/message';

export class TransferHandler extends FsDbHandler {
  constructor(private fsMessage: FsMessage) {
    super();
  }

  begin(params) {
    this.fsMessage.info('Starting download...');
  }

  error(data, raw) {
    const message = data && data.message ? data.message : 'There was a problem with the download';
    this.fsMessage.error(message);
  }
}`;

  public moduleCode = `
import { FS_TRANSFER_HANDLER } from '@firestitch/db';
import { TransferHandler } from './app/handlers/transfer.handler';


@NgModule({
  imports: [
    FsDbModule
  ],
  providers: [
    {
      provide: FS_TRANSFER_HANDLER,
      useClass: TransferHandler,
      deps: [ FsMessage ]
    }
  ]
})`;
}
