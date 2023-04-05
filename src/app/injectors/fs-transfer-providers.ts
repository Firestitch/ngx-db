import { InjectionToken } from '@angular/core';
import { FsDbHandler } from '../handlers/transfer.handler';

export const FS_TRANSFER_HANDLER = new InjectionToken<FsDbHandler>('fs-transfer.request_interceptors');
