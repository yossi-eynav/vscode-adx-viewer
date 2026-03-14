// Mock azure packages before any imports that transitively load queryService
jest.mock('azure-kusto-data', () => ({
  Client: jest.fn(),
  KustoConnectionStringBuilder: { withTokenCredential: jest.fn() },
}));
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn(),
}));

import { AdxResultsTreeProvider, AdxResultNode } from '../../src/providers/adxResultsTreeProvider';
import { ColumnType } from '../../src/types/messages';
import { QueryResult } from '../../src/services/queryService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoot(provider: AdxResultsTreeProvider): AdxResultNode[] {
  return provider.getChildren(undefined) as AdxResultNode[];
}

function makeResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    columns: [
      { name: 'ts', type: ColumnType.datetime },
      { name: 'val', type: ColumnType.numeric },
    ],
    rows: [
      ['2026-01-01', 42],
      ['2026-01-02', 99],
    ],
    totalRowCount: 2,
    truncated: false,
    executedAt: new Date('2026-03-14'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('AdxResultsTreeProvider — initial state', () => {
  it('exposes onDidChangeTreeData event', () => {
    const provider = new AdxResultsTreeProvider();
    expect(typeof provider.onDidChangeTreeData).toBe('function');
  });

  it('root shows single idle status node', () => {
    const provider = new AdxResultsTreeProvider();
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('Open a .adx file');
    }
  });
});

// ---------------------------------------------------------------------------
// setLoading()
// ---------------------------------------------------------------------------

describe('setLoading()', () => {
  it('replaces nodes with a single loading status node', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setLoading();
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('Loading');
    }
  });

  it('fires onDidChangeTreeData with undefined', () => {
    const provider = new AdxResultsTreeProvider();
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.setLoading();
    expect(spy).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// setError()
// ---------------------------------------------------------------------------

describe('setError()', () => {
  it('sets a single error status node containing the message', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setError('cluster unreachable');
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('cluster unreachable');
    }
  });

  it('fires onDidChangeTreeData', () => {
    const provider = new AdxResultsTreeProvider();
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.setError('oops');
    expect(spy).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// setNoCredentials()
// ---------------------------------------------------------------------------

describe('setNoCredentials()', () => {
  it('sets a credentials-not-configured status node', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setNoCredentials();
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('credentials not configured');
    }
  });

  it('fires onDidChangeTreeData', () => {
    const provider = new AdxResultsTreeProvider();
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.setNoCredentials();
    expect(spy).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// setResults() — normal result
// ---------------------------------------------------------------------------

describe('setResults() — normal result (2 rows, not truncated)', () => {
  it('shows two row nodes at root', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult());
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].kind).toBe('row');
    expect(nodes[1].kind).toBe('row');
    if (nodes[0].kind === 'row') expect(nodes[0].index).toBe(0);
    if (nodes[1].kind === 'row') expect(nodes[1].index).toBe(1);
  });

  it('does not add truncation notice when not truncated', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult({ truncated: false, totalRowCount: 2 }));
    const nodes = getRoot(provider);
    expect(nodes.every(n => n.kind !== 'status')).toBe(true);
  });

  it('fires onDidChangeTreeData', () => {
    const provider = new AdxResultsTreeProvider();
    const spy = jest.fn();
    provider.onDidChangeTreeData(spy);
    provider.setResults(makeResult());
    expect(spy).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// setResults() — empty result
// ---------------------------------------------------------------------------

describe('setResults() — empty result set', () => {
  it('shows a single "No results" status node', () => {
    const provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult({ rows: [], totalRowCount: 0 }));
    const nodes = getRoot(provider);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('No results');
    }
  });
});

// ---------------------------------------------------------------------------
// setResults() — truncation (> 500 rows)
// ---------------------------------------------------------------------------

describe('setResults() — truncated result', () => {
  it('caps rows at 500 and adds a truncation status node', () => {
    const rows = Array.from({ length: 600 }, (_, i) => [String(i), i]);
    const provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult({ rows, totalRowCount: 600, truncated: true }));
    const nodes = getRoot(provider);

    // First node should be the truncation notice
    expect(nodes[0].kind).toBe('status');
    if (nodes[0].kind === 'status') {
      expect(nodes[0].label).toContain('500');
      expect(nodes[0].label).toContain('600');
    }

    // Remaining nodes should be exactly 500 rows
    const rowNodes = nodes.filter(n => n.kind === 'row');
    expect(rowNodes).toHaveLength(500);
  });

  it('also truncates when rows.length > 500 even if truncated flag is false', () => {
    const rows = Array.from({ length: 510 }, (_, i) => [String(i), i]);
    const provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult({ rows, totalRowCount: 510, truncated: false }));
    const nodes = getRoot(provider);
    const rowNodes = nodes.filter(n => n.kind === 'row');
    expect(rowNodes).toHaveLength(500);
    const statusNodes = nodes.filter(n => n.kind === 'status');
    expect(statusNodes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getTreeItem()
// ---------------------------------------------------------------------------

describe('getTreeItem()', () => {
  let provider: AdxResultsTreeProvider;

  beforeEach(() => {
    provider = new AdxResultsTreeProvider();
  });

  it('StatusNode → TreeItem with collapsibleState None', () => {
    const node: AdxResultNode = { kind: 'status', id: 'test', label: 'Test label' };
    const item = provider.getTreeItem(node);
    expect(item.label).toBe('Test label');
    expect(item.collapsibleState).toBe(0); // TreeItemCollapsibleState.None
    expect(item.id).toBe('test');
  });

  it('RowNode → TreeItem with label "Row N" and collapsibleState Collapsed', () => {
    const node: AdxResultNode = {
      kind: 'row',
      index: 3,
      row: ['2026-01-01', 7],
      columns: [
        { name: 'ts', type: ColumnType.datetime },
        { name: 'val', type: ColumnType.numeric },
      ],
    };
    const item = provider.getTreeItem(node);
    expect(item.label).toBe('Row 3');
    expect(item.collapsibleState).toBe(1); // TreeItemCollapsibleState.Collapsed
  });

  it('CellNode → TreeItem with "colName: value" label and column type as description', () => {
    const node: AdxResultNode = {
      kind: 'cell',
      rowIndex: 0,
      column: { name: 'val', type: ColumnType.numeric },
      value: 42,
    };
    const item = provider.getTreeItem(node);
    expect(item.label).toBe('val: 42');
    expect(item.description).toBe(ColumnType.numeric);
    expect(item.collapsibleState).toBe(0); // TreeItemCollapsibleState.None
  });

  it('CellNode with null value renders "(null)"', () => {
    const node: AdxResultNode = {
      kind: 'cell',
      rowIndex: 0,
      column: { name: 'x', type: ColumnType.string },
      value: null,
    };
    const item = provider.getTreeItem(node);
    expect(item.label).toBe('x: (null)');
  });
});

// ---------------------------------------------------------------------------
// getChildren()
// ---------------------------------------------------------------------------

describe('getChildren()', () => {
  let provider: AdxResultsTreeProvider;

  beforeEach(() => {
    provider = new AdxResultsTreeProvider();
    provider.setResults(makeResult());
  });

  it('root (undefined) returns the _nodes array', () => {
    const root = provider.getChildren(undefined) as AdxResultNode[];
    expect(Array.isArray(root)).toBe(true);
    expect(root.length).toBeGreaterThan(0);
  });

  it('RowNode returns one CellNode per column', () => {
    const root = provider.getChildren(undefined) as AdxResultNode[];
    const row0 = root.find(n => n.kind === 'row' && n.index === 0)!;
    const cells = provider.getChildren(row0) as AdxResultNode[];
    expect(cells).toHaveLength(2);
    expect(cells[0].kind).toBe('cell');
    expect(cells[1].kind).toBe('cell');
    if (cells[0].kind === 'cell') {
      expect(cells[0].column.name).toBe('ts');
      expect(cells[0].value).toBe('2026-01-01');
    }
    if (cells[1].kind === 'cell') {
      expect(cells[1].column.name).toBe('val');
      expect(cells[1].value).toBe(42);
    }
  });

  it('StatusNode returns empty array', () => {
    const statusNode: AdxResultNode = { kind: 'status', id: 's', label: 'x' };
    expect(provider.getChildren(statusNode)).toEqual([]);
  });

  it('CellNode returns empty array', () => {
    const cellNode: AdxResultNode = {
      kind: 'cell',
      rowIndex: 0,
      column: { name: 'x', type: ColumnType.string },
      value: 'v',
    };
    expect(provider.getChildren(cellNode)).toEqual([]);
  });
});
