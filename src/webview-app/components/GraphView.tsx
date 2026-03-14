import { useEffect, useRef, useMemo } from 'react';
import { Chart, registerables, type TooltipItem } from 'chart.js';
import type { ResultColumn, ResultRow } from '../../types/messages';
import { ColumnType } from '../../types/messages';

Chart.register(...registerables);

interface Props {
  columns: ResultColumn[];
  rows: ResultRow[];
  totalRowCount: number;
  executedAt: string;
  queryDurationMs: number;
}

interface Bucketed {
  labels: string[];
  counts: number[];
  minDate: Date;
  maxDate: Date;
  peakCount: number;
  peakLabel: string;
  bucketCount: number;
}

export function GraphView({ columns, rows, executedAt, queryDurationMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const tsColIdx = useMemo(
    () => columns.findIndex(c => c.type === ColumnType.datetime),
    [columns]
  );

  const bucketed = useMemo<Bucketed | null>(() => {
    if (tsColIdx < 0) return null;

    const map = new Map<number, number>();
    let min = Infinity, max = -Infinity;

    for (const row of rows) {
      const raw = row[tsColIdx];
      if (raw == null) continue;
      const ts = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
      if (isNaN(ts)) continue;
      const bucket = Math.floor(ts / 60_000) * 60_000;
      map.set(bucket, (map.get(bucket) ?? 0) + 1);
      if (bucket < min) min = bucket;
      if (bucket > max) max = bucket;
    }

    if (map.size === 0) return null;

    const points: { t: number; count: number }[] = [];
    for (let t = min; t <= max; t += 60_000) {
      points.push({ t, count: map.get(t) ?? 0 });
    }

    const multiDay = new Date(max).toDateString() !== new Date(min).toDateString();
    const labels = points.map(({ t }) => {
      const d = new Date(t);
      const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return multiDay ? `${d.getMonth() + 1}/${d.getDate()} ${hm}` : hm;
    });

    const counts = points.map(p => p.count);
    const peakIdx = counts.indexOf(Math.max(...counts));

    return {
      labels,
      counts,
      minDate: new Date(min),
      maxDate: new Date(max),
      peakCount: counts[peakIdx],
      peakLabel: labels[peakIdx],
      bucketCount: points.length,
    };
  }, [rows, tsColIdx]);

  useEffect(() => {
    if (!canvasRef.current || !bucketed) return;
    chartRef.current?.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const style = getComputedStyle(document.body);
    const accent = style.getPropertyValue('--vscode-textLink-foreground').trim() || '#4daafc';
    const fg = style.getPropertyValue('--vscode-foreground').trim() || '#cccccc';
    const fgDim = style.getPropertyValue('--vscode-descriptionForeground').trim() || 'rgba(204,204,204,0.6)';
    const grid = style.getPropertyValue('--vscode-editorGroup-border').trim() || 'rgba(255,255,255,0.08)';
    const tooltipBg = style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

    const h = canvasRef.current.offsetHeight || 320;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colorWithAlpha(accent, 0.28));
    grad.addColorStop(0.7, colorWithAlpha(accent, 0.06));
    grad.addColorStop(1, colorWithAlpha(accent, 0));

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: bucketed.labels,
        datasets: [{
          label: 'Events',
          data: bucketed.counts,
          borderColor: accent,
          backgroundColor: grad,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: bucketed.bucketCount > 80 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: accent,
          pointBorderColor: tooltipBg,
          pointBorderWidth: 2,
          pointHitRadius: 12,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colorWithAlpha(tooltipBg, 0.97),
            titleColor: fg,
            bodyColor: fgDim,
            borderColor: grid,
            borderWidth: 1,
            padding: { x: 14, y: 10 },
            displayColors: false,
            callbacks: {
              title: (items: TooltipItem<'line'>[]) => `${items[0]?.label ?? ''}`,
              label: (item: TooltipItem<'line'>) => `  ${item.raw} events`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: grid, drawTicks: false },
            border: { color: grid },
            ticks: {
              color: fgDim,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
              font: { size: 11 },
              padding: 8,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid, drawTicks: false },
            border: { color: grid, dash: [3, 3] },
            ticks: {
              color: fgDim,
              precision: 0,
              font: { size: 11 },
              padding: 8,
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [bucketed]);

  if (tsColIdx < 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
        No datetime column found in results. The graph requires a datetime column.
      </div>
    );
  }

  if (!bucketed) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
        No data to display.
      </div>
    );
  }

  const totalEvents = bucketed.counts.reduce((a, b) => a + b, 0);
  const avgPerMin = (totalEvents / bucketed.bucketCount).toFixed(1);
  const duration = queryDurationMs >= 1000
    ? `${(queryDurationMs / 1000).toFixed(2)}s`
    : `${queryDurationMs}ms`;
  const timeRange = `${fmtTime(bucketed.minDate)} – ${fmtTime(bucketed.maxDate)}`;

  return (
    <div style={{ padding: '4px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.05em', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
          Event Timeline
        </h2>
        <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
          1-minute buckets · {new Date(executedAt).toLocaleTimeString()} · {duration}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <StatCard label="Total events" value={totalEvents.toLocaleString()} />
        <StatCard label="Time range" value={timeRange} wide />
        <StatCard label="Peak (1 min)" value={`${bucketed.peakCount.toLocaleString()} @ ${bucketed.peakLabel}`} wide />
        <StatCard label="Avg / min" value={avgPerMin} />
        <StatCard label="Buckets" value={`${bucketed.bucketCount}`} />
      </div>

      {/* Chart area */}
      <div style={{
        position: 'relative',
        height: '360px',
        background: 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 35%, transparent)',
        borderRadius: '8px',
        border: '1px solid var(--vscode-editorGroup-border)',
        padding: '20px 20px 14px 16px',
      }}>
        <canvas ref={canvasRef} />
      </div>

      {bucketed.bucketCount > 80 && (
        <div style={{ marginTop: '6px', fontSize: '0.76em', color: 'var(--vscode-descriptionForeground)', textAlign: 'right', opacity: 0.7 }}>
          Point markers hidden ({bucketed.bucketCount} data points)
        </div>
      )}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{
      flex: wide ? '1 1 150px' : '0 0 auto',
      minWidth: 0,
      padding: '10px 16px',
      background: 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 60%, transparent)',
      borderRadius: '6px',
      border: '1px solid var(--vscode-editorGroup-border)',
    }}>
      <div style={{
        fontSize: '0.72em',
        color: 'var(--vscode-descriptionForeground)',
        marginBottom: '5px',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1em',
        fontWeight: 600,
        color: 'var(--vscode-foreground)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
  }
  return `rgba(77,170,252,${alpha})`;
}
