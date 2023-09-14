import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { FsDateModule } from '@firestitch/date';
import { FsListModule } from '@firestitch/list';

import { ConsoleComponent } from './components';
import { FsDb } from './services';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,

    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,

    FsListModule,
    FsDateModule,

  ],
  declarations: [
    ConsoleComponent,
  ],
  exports: [
    ConsoleComponent,
  ],
})
export class FsDbModule {
  public static forRoot(): ModuleWithProviders<FsDbModule> {
    return {
      ngModule: FsDbModule,
      providers: [FsDb],
    };
  }
}
