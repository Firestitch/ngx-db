import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';


import { FsDbModule } from '@firestitch/db';
import { FsExampleModule } from '@firestitch/example';
import { FsMessageModule, FsMessage } from '@firestitch/message';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import { AppMaterialModule } from './material.module';
import { GetComponent } from './components';
import { ConsoleComponent } from './components/console';


@NgModule({
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    FsDbModule.forRoot(),
    BrowserAnimationsModule,
    AppMaterialModule,
    FormsModule,
    FsExampleModule.forRoot(),
    FsMessageModule.forRoot(),
    FsMessageModule,
    FsDbModule,
  ],
  declarations: [
    AppComponent,
    GetComponent,
    ConsoleComponent,
  ],
})
export class PlaygroundModule {
}
