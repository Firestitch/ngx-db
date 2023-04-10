
// export interface Data<T> & {
//   date: Date;
//   number: number;
// } & T


export type Data<T> = {
  _revision: {
    date: Date;
    number: number;
  };
} & T;
