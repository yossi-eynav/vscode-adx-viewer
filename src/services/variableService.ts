import * as vscode from 'vscode';
import type { QueryVariable } from '../types/variables';

const STORAGE_KEY = 'adxViewer.queryVariables';

export function getVariables(state: vscode.Memento): QueryVariable[] {
  return state.get<QueryVariable[]>(STORAGE_KEY, []);
}

export async function saveVariables(
  state: vscode.Memento,
  variables: QueryVariable[]
): Promise<void> {
  await state.update(STORAGE_KEY, variables);
}

export interface ActiveFilter {
  name: string;
  columnName: string;
  value: string;
}

export function getActiveFilters(variables: QueryVariable[]): ActiveFilter[] {
  return variables
    .filter((v): v is QueryVariable & { selectedValue: string } =>
      v.selectedValue !== undefined && v.selectedValue !== ''
    )
    .map(v => ({ name: v.name, columnName: v.columnName, value: v.selectedValue }));
}

/**
 * Appends `| where col == "val"` for each active variable filter.
 * Appending is safe for all KQL forms: plain queries, `let`-prefixed queries,
 * and aggregated queries (filters the output of the last tabular expression).
 */
export function applyVariablesToQuery(
  queryText: string,
  variables: QueryVariable[]
): string {
  const active = getActiveFilters(variables);
  if (active.length === 0) return queryText;

  const clauses = active
    .map(f => `| where ${f.columnName} == ${JSON.stringify(f.value)}`)
    .join('\n');

  return `${queryText.trimEnd()}\n${clauses}`;
}
