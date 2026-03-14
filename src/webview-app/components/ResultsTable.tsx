import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import JsonView from '@uiw/react-json-view';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import type { ResultColumn, ResultRow } from '../../types/messages';
import { ColumnType } from '../../types/messages';

const MAX_CELL_CHARS = 120;

type RowData = Record<string, string | number | boolean | null>;

const columnHelper = createColumnHelper<RowData>();

function toRowData(columns: ResultColumn[], rows: ResultRow[]): RowData[] {
  return rows.map(row => {
    const obj: RowData = {};
    columns.forEach((col, i) => { obj[col.name] = row[i] ?? null; });
    return obj;
  });
}

interface Props {
  columns: ResultColumn[];
  rows: ResultRow[];
  jsonColumns: string[];
}

export function ResultsTable({ columns, rows, jsonColumns }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterText, setFilterText] = useState('');
  const [groupByColumn, setGroupByColumn] = useState<string>('');

  // Filter rows by text across all cells
  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      row.some(cell => cell !== null && String(cell).toLowerCase().includes(q))
    );
  }, [rows, filterText]);

  // Group by aggregation
  const groupByData = useMemo(() => {
    if (!groupByColumn) return null;
    const colIdx = columns.findIndex(c => c.name === groupByColumn);
    if (colIdx < 0) return null;
    const counts = new Map<string, number>();
    for (const row of filteredRows) {
      const key = row[colIdx] === null || row[colIdx] === undefined ? '(null)' : String(row[colIdx]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, groupByColumn, columns]);

  const data = useMemo(() => toRowData(columns, filteredRows), [columns, filteredRows]);

  const tableColumns = useMemo(
    () => columns.map(col =>
      columnHelper.accessor(row => row[col.name], {
        id: col.name,
        header: col.name,
        sortingFn: col.type === ColumnType.datetime
          ? (rowA, rowB, columnId) => {
              const a = new Date(String(rowA.getValue(columnId) ?? '')).getTime();
              const b = new Date(String(rowB.getValue(columnId) ?? '')).getTime();
              return (isNaN(a) ? -Infinity : a) - (isNaN(b) ? -Infinity : b);
            }
          : 'auto',
        cell: info => <CellValue value={info.getValue()} isJsonColumn={jsonColumns.includes(col.name)} />,
      })
    ),
    [columns, jsonColumns] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  const isFiltered = filterText.trim().length > 0;

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 0 10px',
        flexWrap: 'wrap',
      }}>
        {/* Filter input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', minWidth: 0 }}>
          <input
            type="text"
            placeholder="Filter rows…"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--vscode-input-background, #3c3c3c)',
              border: '1px solid var(--vscode-input-border, #555)',
              borderRadius: '3px',
              color: 'var(--vscode-input-foreground, #cccccc)',
              padding: '4px 8px',
              fontSize: '0.9em',
              outline: 'none',
              minWidth: 0,
            }}
          />
          {isFiltered && (
            <>
              <span style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap' }}>
                {filteredRows.length} / {rows.length} rows
              </span>
              <button
                onClick={() => setFilterText('')}
                title="Clear filter"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--vscode-descriptionForeground)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '1em',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </>
          )}
        </div>

        {/* Group by select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>Group by</span>
          <select
            value={groupByColumn}
            onChange={e => setGroupByColumn(e.target.value)}
            style={{
              background: 'var(--vscode-dropdown-background, #3c3c3c)',
              border: '1px solid var(--vscode-dropdown-border, #555)',
              borderRadius: '3px',
              color: 'var(--vscode-dropdown-foreground, #cccccc)',
              padding: '4px 6px',
              fontSize: '0.85em',
              cursor: 'pointer',
            }}
          >
            <option value="">— none —</option>
            {columns.map(col => (
              <option key={col.name} value={col.name}>{col.name}</option>
            ))}
          </select>
          {groupByColumn && (
            <button
              onClick={() => setGroupByColumn('')}
              title="Clear group by"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--vscode-descriptionForeground)',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '1em',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Group by view */}
      {groupByData ? (
        <GroupByView
          columnName={groupByColumn}
          groups={groupByData}
          totalRows={filteredRows.length}
          onFilterByValue={val => {
            setGroupByColumn('');
            setFilterText(val === '(null)' ? '' : val);
          }}
        />
      ) : (
        /* Regular table */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'auto' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          background: 'var(--vscode-editor-lineHighlightBackground)',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderBottom: '2px solid var(--vscode-editorGroup-border)',
                          borderRight: '1px solid var(--vscode-editorGroup-border)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sorted={sorted} />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{
                    background: i % 2 === 0
                      ? 'transparent'
                      : 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 50%, transparent)',
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{
                        padding: '5px 10px',
                        borderBottom: '1px solid var(--vscode-editorGroup-border)',
                        borderRight: '1px solid var(--vscode-editorGroup-border)',
                        verticalAlign: 'top',
                        maxWidth: '480px',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Group By view ────────────────────────────────────────────────────────────

interface GroupByViewProps {
  columnName: string;
  groups: { value: string; count: number }[];
  totalRows: number;
  onFilterByValue: (value: string) => void;
}

function GroupByView({ columnName, groups, totalRows, onFilterByValue }: GroupByViewProps) {
  return (
    <div>
      <div style={{ fontSize: '0.82em', color: 'var(--vscode-descriptionForeground)', marginBottom: '8px' }}>
        {groups.length} distinct values · {totalRows} rows
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
        <thead>
          <tr>
            <th style={thStyle}>{columnName}</th>
            <th style={{ ...thStyle, width: '80px', textAlign: 'right' }}>count</th>
            <th style={{ ...thStyle, width: '60px', textAlign: 'right' }}>%</th>
            <th style={{ ...thStyle, width: '35%' }}></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ value, count }, i) => {
            const pct = totalRows > 0 ? (count / totalRows) * 100 : 0;
            return (
              <tr
                key={value}
                style={{
                  background: i % 2 === 0
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 50%, transparent)',
                  cursor: 'pointer',
                }}
                title="Click to filter table by this value"
                onClick={() => onFilterByValue(value)}
              >
                <td style={tdStyle}>{value}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--vscode-descriptionForeground)' }}>
                  {pct.toFixed(1)}%
                </td>
                <td style={{ ...tdStyle, padding: '5px 10px 5px 6px' }}>
                  <div style={{
                    height: '10px',
                    borderRadius: '2px',
                    background: 'var(--vscode-textLink-foreground, #4daafc)',
                    opacity: 0.7,
                    width: `${pct.toFixed(1)}%`,
                    minWidth: count > 0 ? '2px' : '0',
                  }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  background: 'var(--vscode-editor-lineHighlightBackground)',
  textAlign: 'left',
  padding: '7px 10px',
  borderBottom: '2px solid var(--vscode-editorGroup-border)',
  borderRight: '1px solid var(--vscode-editorGroup-border)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid var(--vscode-editorGroup-border)',
  borderRight: '1px solid var(--vscode-editorGroup-border)',
  verticalAlign: 'middle',
  wordBreak: 'break-word',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <span style={{ fontSize: '0.75em' }}>▲</span>;
  if (sorted === 'desc') return <span style={{ fontSize: '0.75em' }}>▼</span>;
  return <span style={{ fontSize: '0.75em', opacity: 0.3 }}>⇅</span>;
}

function CellValue({ value, isJsonColumn }: { value: unknown; isJsonColumn: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span style={{ opacity: 0.35, fontStyle: 'italic', fontSize: '0.85em' }}>null</span>;
  }

  const str = String(value);

  if (isJsonColumn) {
    if (typeof value === 'object') return <JsonCell data={value} />;
    try { return <JsonCell data={JSON.parse(str)} />; } catch { /* fall through */ }
  }

  if (str.length <= MAX_CELL_CHARS) {
    return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{str}</span>;
  }

  return (
    <span>
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {expanded ? str : str.slice(0, MAX_CELL_CHARS) + '…'}
      </span>
      {' '}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none', border: 'none',
          color: 'var(--vscode-textLink-foreground, #4daafc)',
          cursor: 'pointer', padding: 0,
          fontSize: '0.82em', textDecoration: 'underline', verticalAlign: 'baseline',
        }}
      >
        {expanded ? 'less' : 'more'}
      </button>
    </span>
  );
}

function JsonCell({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'color-mix(in srgb, var(--vscode-textLink-foreground, #4daafc) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--vscode-textLink-foreground, #4daafc) 40%, transparent)',
          borderRadius: '3px',
          color: 'var(--vscode-textLink-foreground, #4daafc)',
          cursor: 'pointer', padding: '1px 7px',
          fontSize: '0.8em', fontFamily: 'monospace',
        }}
      >
        {open ? '▾ JSON' : '{ … }'}
      </button>
      {open && (
        <div style={{
          marginTop: '6px', maxHeight: '280px', overflowY: 'auto',
          borderRadius: '4px', border: '1px solid var(--vscode-editorGroup-border)', fontSize: '0.82em',
        }}>
          <JsonView
            value={data as object}
            style={{ ...vscodeTheme, padding: '8px', fontSize: '12px' }}
            collapsed={2}
            enableClipboard
          />
        </div>
      )}
    </div>
  );
}
