import { ColumnType } from '../../src/types/messages';
import {
  mapColumnType,
  selectChartType,
  rowsToChartData,
} from '../../src/webview/resultTransformer';

describe('mapColumnType', () => {
  it('maps datetime to ColumnType.datetime', () => {
    expect(mapColumnType('datetime')).toBe(ColumnType.datetime);
  });

  it('maps date to ColumnType.datetime', () => {
    expect(mapColumnType('date')).toBe(ColumnType.datetime);
  });

  it('maps int to ColumnType.numeric', () => {
    expect(mapColumnType('int')).toBe(ColumnType.numeric);
  });

  it('maps long to ColumnType.numeric', () => {
    expect(mapColumnType('long')).toBe(ColumnType.numeric);
  });

  it('maps real to ColumnType.numeric', () => {
    expect(mapColumnType('real')).toBe(ColumnType.numeric);
  });

  it('maps decimal to ColumnType.numeric', () => {
    expect(mapColumnType('decimal')).toBe(ColumnType.numeric);
  });

  it('maps string to ColumnType.string', () => {
    expect(mapColumnType('string')).toBe(ColumnType.string);
  });

  it('maps guid to ColumnType.string', () => {
    expect(mapColumnType('guid')).toBe(ColumnType.string);
  });

  it('maps dynamic to ColumnType.string', () => {
    expect(mapColumnType('dynamic')).toBe(ColumnType.string);
  });

  it('maps bool to ColumnType.bool', () => {
    expect(mapColumnType('bool')).toBe(ColumnType.bool);
  });

  it('maps timespan to ColumnType.timespan', () => {
    expect(mapColumnType('timespan')).toBe(ColumnType.timespan);
  });

  it('maps unknown types to ColumnType.other', () => {
    expect(mapColumnType('unknowntype')).toBe(ColumnType.other);
  });
});

describe('selectChartType', () => {
  it('returns line for datetime + numeric columns', () => {
    const columns = [
      { name: 'Timestamp', type: ColumnType.datetime },
      { name: 'Count', type: ColumnType.numeric },
    ];
    expect(selectChartType(columns)).toBe('line');
  });

  it('returns bar for string + numeric columns (no datetime)', () => {
    const columns = [
      { name: 'Name', type: ColumnType.string },
      { name: 'Value', type: ColumnType.numeric },
    ];
    expect(selectChartType(columns)).toBe('bar');
  });

  it('returns bar when there are only string columns', () => {
    const columns = [{ name: 'Name', type: ColumnType.string }];
    expect(selectChartType(columns)).toBe('bar');
  });

  it('returns bar when no numeric column exists', () => {
    const columns = [
      { name: 'Timestamp', type: ColumnType.datetime },
      { name: 'Label', type: ColumnType.string },
    ];
    expect(selectChartType(columns)).toBe('bar');
  });
});

describe('rowsToChartData', () => {
  it('produces correct Chart.js dataset structure for datetime+numeric', () => {
    const columns = [
      { name: 'Timestamp', type: ColumnType.datetime },
      { name: 'Count', type: ColumnType.numeric },
    ];
    const rows = [
      ['2024-01-01', 10],
      ['2024-01-02', 20],
    ];

    const result = rowsToChartData(columns, rows);

    expect(result.labels).toEqual(['2024-01-01', '2024-01-02']);
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].label).toBe('Count');
    expect(result.datasets[0].data).toEqual([10, 20]);
  });

  it('produces correct structure for string+numeric (bar)', () => {
    const columns = [
      { name: 'Category', type: ColumnType.string },
      { name: 'Total', type: ColumnType.numeric },
    ];
    const rows = [
      ['A', 100],
      ['B', 200],
    ];

    const result = rowsToChartData(columns, rows);

    expect(result.labels).toEqual(['A', 'B']);
    expect(result.datasets[0].label).toBe('Total');
    expect(result.datasets[0].data).toEqual([100, 200]);
  });
});
