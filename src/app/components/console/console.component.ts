import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { ActionMode, ItemType } from '@firestitch/filter';
import { FsListConfig, PaginationStrategy, FsListModule } from '@firestitch/list';
import { FsMessage } from '@firestitch/message';
import { FsPrompt } from '@firestitch/prompt';

import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { Store } from '../../classes';
import { SyncStates } from '../../consts';
import { filter, limit, sort, sortDate } from '../../operators';
import { FsDb } from '../../services';
import { FsDateModule } from '@firestitch/date';
import { JsonPipe } from '@angular/common';


@Component({
    selector: 'fs-db-console',
    templateUrl: './console.component.html',
    styleUrls: ['./console.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FsListModule,
        FsDateModule,
        JsonPipe,
    ],
})
export class ConsoleComponent implements OnInit {
  private _db = inject(FsDb);
  private _message = inject(FsMessage);
  private _prompt = inject(FsPrompt);


  public stores: Store<any>[];
  public store: Store<any>;

  public listConfig: FsListConfig;

  public ngOnInit(): void {
    this.stores = this._db.stores;

    this.listConfig = {
      chips: true,
      paging: {
        strategy: PaginationStrategy.Offset,
      },
      filters: [
        {
          name: 'keyword',
          type: ItemType.Keyword,
          label: 'Search',
        },
        {
          name: 'store',
          type: ItemType.Select,
          label: 'Store',
          values: () => {
            return this._db.stores
              .map((store) => {
                return { name: store.name, value: store.name };
              });
          },
        },
        {
          name: 'syncState',
          type: ItemType.Select,
          label: 'Sync State',
          values: () => {
            return SyncStates;
          },
        },
      ],
      actions: [
        {
          mode: ActionMode.Menu,
          primary: false,
          label: 'Actions',
          items: [
            {
              label: 'Start Sync',
              click: () => this.startSync(),
            },
            {
              label: 'Stop Sync',
              click: () => this.stopSync(),
            },
            {
              label: 'Destroy DB',
              click: () => this._db.destroy()
                .subscribe(),
            },
            {
              label: 'Clean DB',
              click: () => this._db.clear()
                .subscribe(),
            },
          ],
        },
      ],
      fetch: (query) => {
        if (!query.store) {
          return of({ data: [] });
        }

        const store = this._db.store(query.store);

        if (!store) {
          return of({ data: [] });
        }

        const operators: any = [];
        const orderDirection = query.order?.match(/,(.*?)$/);

        const getOperators: any = [];
        if (query.order?.match(/syncDate/)) {
          getOperators.push(sortDate(['_sync', 'date'], orderDirection[1] || 'asc'));
        }

        if (query.order?.match(/syncState/)) {
          getOperators.push(sort(['_sync', 'date'], orderDirection[1] || 'asc'));
        }


        if (query.syncState) {
          operators.push(filter((data) => {
            return data._sync?.state === query.syncState;
          }));
        }

        if (query.keyword) {
          operators.push(filter((data) => {
            return Object.keys(data)
              .some((key) => {
                const item = data[key];

                if (item !== null || item !== undefined) {
                  try {
                    return item.toString().toLocaleLowerCase().indexOf(query.keyword) !== -1;
                  } catch (e) { }
                }

                return false;
              });
          }));
        }

        return forkJoin({
          storeData: store.gets(...[
            ...getOperators,
            ...operators,
            limit(query.limit, query.offset),
          ]),
          records: store.count(...operators),
        })
          .pipe(
            map(({ storeData, records }) => {
              return {
                data: storeData.map((data) => {
                  const sync = data._sync;
                  delete data._sync;

                  return { data, sync };
                }),
                paging: { records, offset: query.offset },
              };
            }),
          );
      },
    };
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
