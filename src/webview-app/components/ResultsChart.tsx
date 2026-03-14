import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ResultColumn, ResultRow } from '../../types/messages';
import { ColumnType } from '../../types/messages';

Chart.register(...registerables);

interface Props {
  columns: ResultColumn[];
  rows: ResultRow[];
}

export function ResultsChart({ columns, rows }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const numericCols = columns.map((c, i) => ({ c, i })).filter(x => x.c.type === ColumnType.numeric);
  const labelColIdx = columns.findIndex(c => c.type !== ColumnType.numeric);

  useEffect(() => {
    if (!canvasRef.current || numericCols.length === 0) return;

    chartRef.current?.destroy();

    const labels = rows.map(row => (labelColIdx >= 0 ? String(row[labelColIdx] ?? '') : ''));
    const datasets = numericCols.map(({ c, i }) => ({
      label: c.name,
      data: rows.map(row => row[i] as number | null),
      fill: false,
    }));

    const hasDatetime = columns.some(c => c.type === ColumnType.datetime);
    const chartType = hasDatetime ? 'line' as const : 'bar' as const;

    chartRef.current = new Chart(canvasRef.current, {
      type: chartType,
      data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: true },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [columns, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (numericCols.length === 0) return null;

  return (
    <div style={{ marginTop: '24px', maxHeight: '320px' }}>
      <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
    </div>
  );
}
