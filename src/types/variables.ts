export type VariableSource =
  | { kind: 'query'; kql: string }
  | { kind: 'values'; items: string[] };

export interface QueryVariable {
  name: string;
  columnName: string;
  source: VariableSource;
  selectedValue?: string;
}
