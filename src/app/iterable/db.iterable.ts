import { Observable, of } from 'rxjs';
import { mergeScan } from 'rxjs/operators';


export abstract class DbIterable {

  public abstract get data$(): Observable<any>;

  public get data(): Observable<any[]> {
    return this.data$
      .pipe(
        mergeScan((acc, curr) => {
          acc.push(curr);

          return of(acc);
        }, []),
      );
  }

}

