
export interface Changes<T> {
  type?: 'put' | 'delete' | 'clear';
  data: T | T[];
}

