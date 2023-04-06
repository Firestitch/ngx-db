import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
} from '@angular/core';

import { FsDb, Remote, eq, first, last } from '@firestitch/db';
import { FsMessage } from '@firestitch/message';

import { Subject, merge, of } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

import { BuildingStore, UnitTypeStore } from 'playground/app/stores';
import { DbIterable } from 'src/app/iterable';


@Component({
  selector: 'app-get',
  templateUrl: './get.component.html',
  styleUrls: ['./get.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetComponent implements OnInit, OnDestroy {

  public id = '1';
  public values;

  private _destroy$ = new Subject();

  constructor(
    private _db: FsDb,
    private _message: FsMessage,
    private _cdRef: ChangeDetectorRef,
  ) {
    const remote = new Remote(
      () => of([
        {
          id: 2,
          firstName: 'Mike',
          lastName: 'Waldo',
          revision: {
            firstName: {
              number: 1,
              date: new Date(),
            },
            lastName: {
              number: 2,
              date: new Date(),
            },
          },
        },
      ]),
      () => of(true),
      () => of(true),
      { revisionName: 'revision' },
    );

    this._db
      .register(new UnitTypeStore({ keyName: 'id', remote }))
      .register(new BuildingStore({ keyName: 'id', remote }))
      .init()
      .subscribe();
  }

  public ngOnInit(): void {
    this._db.ready$
      .pipe(
        switchMap(() =>
          merge(
            this._db.store(UnitTypeStore).changes$
              .pipe(
                switchMap(() => this._db.store(UnitTypeStore).gets()),
              ),
            this._db.store(UnitTypeStore).gets(),
          ),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe((values) => {
        this.values = values;
        this._cdRef.markForCheck();
      });
  }

  public getsBilly(): void {
    this._db.store(UnitTypeStore)
      .gets(
        eq('firstName', 'Billy'),
      )
      .subscribe((data)=> {
        this._message.success(JSON.stringify(data));
      });
  }

  public getId(): void {
    this._db.store(UnitTypeStore)
      .get(this.id)
      .subscribe((data)=> {
        console.log(data);
        this._message.success(JSON.stringify(data));
      });
  }

  public put(data): void {
    this._db.store(UnitTypeStore)
      .put(data)
      .subscribe((response)=> {
        this._message.success('Saved');
      });
  }

  public post(): void {
    this._db.store(UnitTypeStore)
      .put({
        id: Math.floor(Math.random() * 100000),
        firstName: 'Luke',
        lastName: 'Skywalker',
      })
      .subscribe(()=> {
        this._message.success('Saved');
      });
  }

  public deleteAll(): void {
    this._db.store(UnitTypeStore)
      .clear()
      .subscribe(()=> {
        this._message.success('Deleted All');
      });
  }

  public deleteFirst(): void {
    this._db.store(UnitTypeStore)
      .delete(
        first(),
      )
      .subscribe(()=> {
        this._message.success('Deleted last');
      });
  }

  public getKeys(): void {
    this._db.store(UnitTypeStore)
      .keys()
      .subscribe((values)=> {
        this.values = values;
        this._cdRef.markForCheck();
        this._message.success();
      });
  }

  public gets(): void {
    this._db.store(UnitTypeStore)
      .gets()
      .subscribe((values)=> {
        this.values = values;
        this._cdRef.markForCheck();
        this._message.success();
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}

