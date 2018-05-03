import { Inject, Injectable, Optional } from '@angular/core';
import { guid } from '@firestitch/common/util';

import { FS_DOWNLOAD_HANDLER } from '../fs-dowload-providers';
import { FsDownloadHandler } from '../interceptors';


@Injectable()
export class FsDownloadService {

  constructor(
    // Custom interceptors
    @Optional() @Inject(FS_DOWNLOAD_HANDLER) private handler: FsDownloadHandler,
  ) {
  }

  public download(path, method = 'get', parameters = {}) {
    this.handler.begin(parameters);
    const uniqID = guid();

    const container = this.initContainer();
    const iframe = this.initFrame(uniqID);
    const form = this.initForm(path, method, parameters, uniqID);

    container.appendChild(form);
    container.appendChild(iframe);

    document.body.appendChild(container);
    form.submit();
  }

  private initContainer() {
    const prevFrame = document.getElementById('former-container');
    if (prevFrame) { prevFrame.remove(); }

    const container = document.createElement('div');
    container.setAttribute('id', 'former-container');
    container.setAttribute('style', 'display: none');
    container.setAttribute('data-type', 'iframe');

    return container;
  }

  private initFrame(uniqID) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'about:blank');
    iframe.setAttribute('name', `former-iframe-${uniqID}`);
    iframe.setAttribute('id', `former-iframe-${uniqID}`);
    iframe.setAttribute('class', 'former-iframe');

    iframe.setAttribute('style', 'display: none;');

    iframe.onload = () => {
      let data: any = {};

      try {
        const iframeBody = iframe.contentWindow.document.body;

        try {
          data = JSON.parse(iframeBody.innerText);
        } catch (e) {}

      } catch (e) {
        data.message = e.message;
      }

      this.handler.error(data.message, data.exception);
    };

    return iframe;
  }

  private initForm(path, method, parameters, uniqID) {
    const form = document.createElement('form');
    form.setAttribute('action', path);
    form.setAttribute('method', method);
    form.setAttribute('target', `former-iframe-${uniqID}`);

    for (const paramKey in parameters) {
      if (parameters.hasOwnProperty(paramKey)) {
        let value = parameters[paramKey];
        if (value instanceof Object) { value = JSON.stringify(value); }

        const paramInput = document.createElement('input');
        paramInput.setAttribute('type', 'hidden');
        paramInput.setAttribute('name', paramKey);
        paramInput.setAttribute('value', value);

        form.appendChild(paramInput);
      }
    }

    return form;
  }
}
