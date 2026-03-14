import * as vscode from 'vscode';
import { QueryResult } from '../services/queryService';
import { ResultColumn, ResultRow } from '../types/messages';

export const VIEW_ID = 'adxQueryResults';

const MAX_TREE_ROWS = 500;

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

type StatusNode = {
  kind: 'status';
  id: string;
  label: string;
  description?: string;
};

type RowNode = {
  kind: 'row';
  index: number;
  row: ResultRow;
  columns: ResultColumn[];
};

type CellNode = {
  kind: 'cell';
  rowIndex: number;
  column: ResultColumn;
  value: string | number | boolean | null;
};

export type AdxResultNode = StatusNode | RowNode | CellNode;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AdxResultsTreeProvider implements vscode.TreeDataProvider<AdxResultNode> {
  private readonly _emitter = new vscode.EventEmitter<AdxResultNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AdxResultNode | undefined | void> =
    this._emitter.event;

  private _nodes: AdxResultNode[] = [
    { kind: 'status', id: 'idle', label: 'Open a .adx file to see results' },
  ];

  setLoading(): void {
    this._nodes = [{ kind: 'status', id: 'loading', label: 'Loading query results\u2026' }];
    this._emitter.fire(undefined);
  }

  setResults(result: QueryResult): void {
    const capped = result.rows.slice(0, MAX_TREE_ROWS);
    const nodes: AdxResultNode[] = [];

    if (result.truncated || result.rows.length > MAX_TREE_ROWS) {
      const shown = Math.min(result.rows.length, MAX_TREE_ROWS);
      nodes.push({
        kind: 'status',
        id: 'truncated',
        label: `Showing ${shown} of ${result.totalRowCount} rows`,
      });
    }

    if (capped.length === 0) {
      nodes.push({ kind: 'status', id: 'empty', label: 'No results' });
    } else {
      for (let i = 0; i < capped.length; i++) {
        nodes.push({ kind: 'row', index: i, row: capped[i], columns: result.columns });
      }
    }

    this._nodes = nodes;
    this._emitter.fire(undefined);
  }

  setError(message: string): void {
    this._nodes = [{ kind: 'status', id: 'error', label: `Error: ${message}` }];
    this._emitter.fire(undefined);
  }

  setNoCredentials(): void {
    this._nodes = [
      { kind: 'status', id: 'no-creds', label: 'ADX credentials not configured' },
    ];
    this._emitter.fire(undefined);
  }

  // ---------------------------------------------------------------------------
  // TreeDataProvider protocol
  // ---------------------------------------------------------------------------

  getTreeItem(element: AdxResultNode): vscode.TreeItem {
    switch (element.kind) {
      case 'status': {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        if (element.description !== undefined) {
          item.description = element.description;
        }
        return item;
      }
      case 'row': {
        const item = new vscode.TreeItem(
          `Row ${element.index}`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.id = `row-${element.index}`;
        return item;
      }
      case 'cell': {
        const valueStr = element.value === null ? '(null)' : String(element.value);
        const item = new vscode.TreeItem(
          `${element.column.name}: ${valueStr}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = element.column.type;
        item.id = `cell-${element.rowIndex}-${element.column.name}`;
        return item;
      }
    }
  }

  getChildren(element?: AdxResultNode): vscode.ProviderResult<AdxResultNode[]> {
    if (!element) {
      return this._nodes;
    }
    if (element.kind === 'row') {
      return element.columns.map((col, i) => ({
        kind: 'cell' as const,
        rowIndex: element.index,
        column: col,
        value: element.row[i] ?? null,
      }));
    }
    return [];
  }
}
