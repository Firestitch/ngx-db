import { enableProdMode, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';


import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { FsDbModule } from '@firestitch/db';
import { provideAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { FsExampleModule } from '@firestitch/example';
import { provideRouter } from '@angular/router';
import { FsMessageModule } from '@firestitch/message';
import { AppComponent } from './app/app.component';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, FsDbModule.forRoot(), FormsModule, FsExampleModule.forRoot(), FsMessageModule.forRoot(), FsMessageModule, FsDbModule),
        provideAnimations(),
        provideRouter([]),
    ]
})
  .catch(err => console.error(err));

