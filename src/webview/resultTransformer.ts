import { ColumnType, ResultColumn, ResultRow } from '../types/messages';

export function mapColumnType(adxType: string): ColumnType {
  switch (adxType.toLowerCase()) {
    case 'datetime':
    case 'date':
      return ColumnType.datetime;
    case 'int':
    case 'long':
    case 'real':
    case 'decimal':
    case 'double':
      return ColumnType.numeric;
    case 'string':
    case 'guid':
    case 'dynamic':
      return ColumnType.string;
    case 'bool':
    case 'boolean':
      return ColumnType.bool;
    case 'timespan':
      return ColumnType.timespan;
    default:
      return ColumnType.other;
  }
}

export function selectChartType(columns: ResultColumn[]): 'line' | 'bar' {
  const hasDatetime = columns.some((c) => c.type === ColumnType.datetime);
  const hasNumeric = columns.some((c) => c.type === ColumnType.numeric);
  return hasDatetime && hasNumeric ? 'line' : 'bar';
}

export interface ChartData {
  labels: (string | number | boolean | null)[];
  datasets: Array<{
    label: string;
    data: (string | number | boolean | null)[];
  }>;
}

export function rowsToChartData(columns: ResultColumn[], rows: ResultRow[]): ChartData {
  // Use first non-numeric column as labels; all numeric columns become datasets
  const labelColIndex = columns.findIndex((c) => c.type !== ColumnType.numeric);
  const numericColIndices = columns
    .map((c, i) => ({ type: c.type, i }))
    .filter(({ type }) => type === ColumnType.numeric)
    .map(({ i }) => i);

  const labels = rows.map((row) =>
    labelColIndex >= 0 ? row[labelColIndex] : String(rows.indexOf(row))
  );

  const datasets = numericColIndices.map((colIdx) => ({
    label: columns[colIdx].name,
    data: rows.map((row) => row[colIdx]),
  }));

  return { labels, datasets };
}
