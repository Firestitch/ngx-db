
// Store subclasses are looked up by their static storeName. Typing this
// structurally (rather than as `typeof Store`) lets any subclass be passed
// regardless of its generic parameter.
export interface StoreClass {
  storeName: string;
  keyName?: string;
}
