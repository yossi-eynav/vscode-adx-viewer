/**
 * Integration tests for AdxResultsTreeProvider.
 *
 * These tests run inside a VS Code host via @vscode/test-electron.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { AdxResultsTreeProvider } from '../../src/providers/adxResultsTreeProvider';
import { ColumnType } from '../../src/types/messages';
import { QueryResult } from '../../src/services/queryService';

const MOCK_RESULT: QueryResult = {
  columns: [
    { name: 'Name', type: ColumnType.string },
    { name: 'Count', type: ColumnType.numeric },
  ],
  rows: [
    ['alpha', 1],
    ['beta', 2],
  ],
  totalRowCount: 2,
  truncated: false,
  executedAt: new Date(),
};

suite('AdxResultsTreeProvider — VS Code integration', () => {
  let provider: AdxResultsTreeProvider;
  let disposable: vscode.Disposable;

  setup(() => {
    provider = new AdxResultsTreeProvider();
    disposable = vscode.window.registerTreeDataProvider('adxQueryResults', provider);
  });

  teardown(() => {
    disposable.dispose();
  });

  test('registers with VS Code without throwing', () => {
    // If we reach here, registration succeeded
    assert.ok(disposable, 'registerTreeDataProvider should return a Disposable');
  });

  test('onDidChangeTreeData fires when setLoading() is called', async () => {
    const fired = await new Promise<boolean>((resolve) => {
      const sub = provider.onDidChangeTreeData(() => {
        sub.dispose();
        resolve(true);
      });
      provider.setLoading();
    });
    assert.strictEqual(fired, true);
  });

  test('onDidChangeTreeData fires when setResults() is called', async () => {
    const fired = await new Promise<boolean>((resolve) => {
      const sub = provider.onDidChangeTreeData(() => {
        sub.dispose();
        resolve(true);
      });
      provider.setResults(MOCK_RESULT);
    });
    assert.strictEqual(fired, true);
  });

  test('onDidChangeTreeData fires when setError() is called', async () => {
    const fired = await new Promise<boolean>((resolve) => {
      const sub = provider.onDidChangeTreeData(() => {
        sub.dispose();
        resolve(true);
      });
      provider.setError('test error');
    });
    assert.strictEqual(fired, true);
  });

  test('getChildren(undefined) returns row nodes after setResults()', () => {
    provider.setResults(MOCK_RESULT);
    const children = provider.getChildren(undefined) as ReturnType<typeof provider.getChildren>;
    assert.ok(Array.isArray(children));
    const nodes = children as Array<{ kind: string }>;
    const rowNodes = nodes.filter(n => n.kind === 'row');
    assert.strictEqual(rowNodes.length, 2);
  });

  test('getChildren on a RowNode returns CellNodes', () => {
    provider.setResults(MOCK_RESULT);
    const root = provider.getChildren(undefined) as Array<{ kind: string }>;
    const row0 = root.find(n => n.kind === 'row');
    assert.ok(row0, 'Expected at least one row node');
    const cells = provider.getChildren(row0 as Parameters<typeof provider.getChildren>[0]) as Array<{ kind: string }>;
    assert.ok(Array.isArray(cells));
    assert.strictEqual(cells.length, MOCK_RESULT.columns.length);
    assert.ok(cells.every(c => c.kind === 'cell'));
  });
});
