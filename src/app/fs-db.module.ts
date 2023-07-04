import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';

import { FsDb } from './services';
import { ConsoleComponent } from './components';


@NgModule({
  imports: [
    CommonModule,

    MatButtonModule,
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
