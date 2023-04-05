import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FsDb } from './services';


@NgModule({
  imports: [
    CommonModule,
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
