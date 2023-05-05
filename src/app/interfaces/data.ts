
export type Data<T> = {
  _sync?: {
    date: Date;
    revision: number;
    message?: string;
  };
} & T;
