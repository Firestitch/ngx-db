
// Operators are tagged factory functions: calling one returns its configuration
// (sort/limit/map) or, for filters, evaluates a record. The tag lives on the
// function's `type` or `name` property and OperatorData dispatches on it.
export type Operator = ((...args: any[]) => any);

export type StorageKey = string | number;
