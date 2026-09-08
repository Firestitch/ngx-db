
export type ChangeType = 'put' | 'delete' | 'clear';

export interface Changes<T> {
  type?: ChangeType;
  // 'put' carries the saved record(s); 'delete' carries only { [keyName]: key }
  // for each removed record; 'clear' carries nothing.
  data?: T | T[] | Record<string, unknown>;
}
