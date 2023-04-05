import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit,
} from '@angular/core';

import { FsDb, Store, eq, first, last } from '@firestitch/db';
import { FsMessage } from '@firestitch/message';

import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { UnitTypeStore } from 'playground/app/stores';


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
    this._db.registerStore(new UnitTypeStore());
  }

  public ngOnInit(): void {
    this._db.store(UnitTypeStore)
      .values$
      .pipe(
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
        console.log(data);
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
      .subscribe((response)=> {
        this._message.success('Saved');
      });
  }

  public deleteAll(): void {
    this._db.store(UnitTypeStore)
      .delete()
      .subscribe(()=> {
        this._message.success('Deleted All');
      });
  }

  public deleteLast(): void {
    this._db.store(UnitTypeStore)
      .delete(
        last(),
      )
      .subscribe(()=> {
        this._message.success('Deleted last');
      });
  }

  public gets(): void {
    this._db.store(UnitTypeStore)
      .gets()
      .subscribe((data)=> {
        console.log(data);
        this._message.success(JSON.stringify(data));
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}

