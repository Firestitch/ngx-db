// @firestitch/common and @firestitch/date are partially-compiled Angular libraries;
// loading the compiler lets their injectables JIT-compile in a plain node test run.
import '@angular/compiler';
import 'fake-indexeddb/auto';
