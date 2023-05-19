import { Operator } from '../types';


export class OperatorData {

  public limit: {
    offset: number;
    limit: number;
    count: number;
  };

  private _filters = [];

  constructor(
    private _operators: Operator[],
  ) {
    const limitOperator = this._operators
      .find((operator: Operator) => (operator as any).type === 'limit');

    this.limit = limitOperator ? limitOperator() : null;
    this._filters = this._operators
      .filter((operator: any) => {
        return operator.type === 'filter';
      });
  }

  public match(value, index): boolean {
    return this._filters.length === 0 ||
      this._filters.every((operator: Operator) => {
        return operator(value, index);
      });
  }

  public get sortOperators(): Operator[] {
    return this._operators
      .filter((operator: any) => {
        return operator.type === 'sort';
      });
  }

  public get mapOneOperators(): Operator[] {
    return this._operators
      .filter((operator: any) => {
        return operator.name === 'mapOne';
      });
  }
}
