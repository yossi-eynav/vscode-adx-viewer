import { useEffect, useRef, useMemo, useState } from 'react';
import { Chart, registerables, type TooltipItem } from 'chart.js';
import type { ResultColumn, ResultRow } from '../../types/messages';
import { ColumnType } from '../../types/messages';

Chart.register(...registerables);

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET_OPTIONS = [
  { label: '5s',  ms: 5_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '5m',  ms: 300_000 },
  { label: '30m', ms: 1_800_000 },
  { label: '1h',  ms: 3_600_000 },
  { label: '6h',  ms: 21_600_000 },
  { label: '1d',  ms: 86_400_000 },
] as const;

const MAX_GROUPS = 8;

const PALETTE = [
  '#4daafc', '#f97583', '#85e89d', '#b392f0',
  '#ffa657', '#79c0ff', '#ffea7f', '#c9d1d9',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  columns: ResultColumn[];
  rows: ResultRow[];
  totalRowCount: number;
  executedAt: string;
  queryDurationMs: number;
}

interface BucketedData {
  labels: string[];
  datasets: Array<{ label: string; counts: number[] }>;
  minDate: Date;
  maxDate: Date;
  effectiveBucketMs: number;
  totalEvents: number;
  peakCount: number;
  peakLabel: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function autoBucketMs(rangeMs: number): number {
  if (rangeMs <= 5 * 60_000)          return 5_000;
  if (rangeMs <= 30 * 60_000)         return 30_000;
  if (rangeMs <= 3 * 3_600_000)       return 60_000;
  if (rangeMs <= 12 * 3_600_000)      return 300_000;
  if (rangeMs <= 2 * 86_400_000)      return 1_800_000;
  if (rangeMs <= 14 * 86_400_000)     return 21_600_000;
  return 86_400_000;
}

function formatBucketLabel(t: number, bucketMs: number, multiDay: boolean): string {
  const d = new Date(t);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  if (bucketMs < 60_000) {
    const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return multiDay ? `${date} ${hms}` : hms;
  }
  if (bucketMs < 86_400_000) {
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return multiDay ? `${date} ${hm}` : hm;
  }
  return date;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(')) return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  if (color.startsWith('rgb('))  return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
  }
  return `rgba(77,170,252,${alpha})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphView({ columns, rows, executedAt, queryDurationMs }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  const [bucketSizeMs, setBucketSizeMs] = useState<number | null>(null); // null = auto
  const [groupByCol,   setGroupByCol]   = useState<string>('');

  const tsColIdx = useMemo(
    () => columns.findIndex(c => c.type === ColumnType.datetime),
    [columns]
  );

  const groupableCols = useMemo(
    () => columns.filter(c => c.type === ColumnType.string || c.type === ColumnType.bool),
    [columns]
  );

  const groupByColIdx = useMemo(
    () => (groupByCol ? columns.findIndex(c => c.name === groupByCol) : -1),
    [columns, groupByCol]
  );

  const data = useMemo<BucketedData | null>(() => {
    if (tsColIdx < 0 || rows.length === 0) return null;

    // First pass: collect timestamps and find range
    const timestamps: number[] = [];
    let min = Infinity, max = -Infinity;
    for (const row of rows) {
      const raw = row[tsColIdx];
      if (raw == null) continue;
      const ts = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
      if (isNaN(ts)) continue;
      timestamps.push(ts);
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
    if (timestamps.length === 0) return null;

    const effectiveBucketMs = bucketSizeMs ?? autoBucketMs(max - min || 60_000);
    const floor  = (ts: number) => Math.floor(ts / effectiveBucketMs) * effectiveBucketMs;
    const minB   = floor(min);
    const maxB   = floor(max);
    const toIdx  = (ts: number) => Math.round((floor(ts) - minB) / effectiveBucketMs);
    const multiDay = new Date(maxB).toDateString() !== new Date(minB).toDateString();

    const bucketTimes: number[] = [];
    for (let t = minB; t <= maxB; t += effectiveBucketMs) bucketTimes.push(t);
    const labels = bucketTimes.map(t => formatBucketLabel(t, effectiveBucketMs, multiDay));

    let datasets: BucketedData['datasets'];

    if (groupByColIdx >= 0) {
      // Find top N groups by event count
      const groupCounts = new Map<string, number>();
      for (const row of rows) {
        const raw = row[tsColIdx];
        if (raw == null) continue;
        const ts = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
        if (isNaN(ts)) continue;
        const gv = row[groupByColIdx];
        const g  = gv == null ? '(null)' : String(gv);
        groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
      }

      const topGroups = [...groupCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_GROUPS)
        .map(([g]) => g);

      // Bucket per group
      const groupMaps = new Map(topGroups.map(g => [g, new Map<number, number>()]));
      for (const row of rows) {
        const raw = row[tsColIdx];
        if (raw == null) continue;
        const ts = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
        if (isNaN(ts)) continue;
        const gv = row[groupByColIdx];
        const g  = gv == null ? '(null)' : String(gv);
        const m  = groupMaps.get(g);
        if (!m) continue;
        const i = toIdx(ts);
        m.set(i, (m.get(i) ?? 0) + 1);
      }

      datasets = topGroups.map(g => ({
        label:  g,
        counts: bucketTimes.map((_, i) => groupMaps.get(g)?.get(i) ?? 0),
      }));
    } else {
      // Single series
      const counts = new Array<number>(bucketTimes.length).fill(0);
      for (const ts of timestamps) counts[toIdx(ts)]++;
      datasets = [{ label: 'Events', counts }];
    }

    const allCounts  = datasets.flatMap(d => d.counts);
    const totalEvents = allCounts.reduce((a, b) => a + b, 0);
    const peakCount  = Math.max(...allCounts);
    const peakBucket = allCounts.indexOf(peakCount) % bucketTimes.length;

    return {
      labels, datasets,
      minDate: new Date(minB), maxDate: new Date(maxB),
      effectiveBucketMs, totalEvents,
      peakCount, peakLabel: labels[peakBucket] ?? '',
    };
  }, [rows, tsColIdx, bucketSizeMs, groupByColIdx]);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    chartRef.current?.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const s        = getComputedStyle(document.body);
    const accent   = s.getPropertyValue('--vscode-textLink-foreground').trim()    || '#4daafc';
    const fg       = s.getPropertyValue('--vscode-foreground').trim()              || '#cccccc';
    const fgDim    = s.getPropertyValue('--vscode-descriptionForeground').trim()   || 'rgba(204,204,204,0.6)';
    const grid     = s.getPropertyValue('--vscode-editorGroup-border').trim()      || 'rgba(255,255,255,0.08)';
    const bgTip    = s.getPropertyValue('--vscode-editor-background').trim()       || '#1e1e1e';

    const isMulti  = data.datasets.length > 1;
    const tooMany  = data.labels.length > 80;

    const chartDatasets = data.datasets.map((ds, i) => {
      const color = isMulti ? PALETTE[i % PALETTE.length] : accent;
      let bg: string | CanvasGradient = colorWithAlpha(color, 0.15);
      if (!isMulti) {
        const h    = canvasRef.current!.offsetHeight || 320;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0,   colorWithAlpha(color, 0.28));
        grad.addColorStop(0.7, colorWithAlpha(color, 0.06));
        grad.addColorStop(1,   colorWithAlpha(color, 0));
        bg = grad;
      }
      return {
        label: ds.label, data: ds.counts,
        borderColor: color, backgroundColor: bg,
        borderWidth: isMulti ? 1.5 : 2,
        fill: !isMulti, tension: 0.4,
        pointRadius: tooMany ? 0 : 3, pointHoverRadius: 6,
        pointBackgroundColor: color, pointBorderColor: bgTip,
        pointBorderWidth: 2, pointHitRadius: 12,
      };
    });

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: data.labels, datasets: chartDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: isMulti,
            labels: { color: fgDim, boxWidth: 12, padding: 16, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: colorWithAlpha(bgTip, 0.97),
            titleColor: fg, bodyColor: fgDim,
            borderColor: grid, borderWidth: 1,
            padding: { x: 14, y: 10 }, displayColors: isMulti,
            callbacks: {
              title: (items: TooltipItem<'line'>[]) => items[0]?.label ?? '',
              label: (item: TooltipItem<'line'>) =>
                isMulti ? `  ${item.dataset.label}: ${item.raw}` : `  ${item.raw} events`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: grid, drawTicks: false }, border: { color: grid },
            ticks: { color: fgDim, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 }, padding: 8 },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid, drawTicks: false }, border: { color: grid, dash: [3, 3] },
            ticks: { color: fgDim, precision: 0, font: { size: 11 }, padding: 8 },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  // ── Early-exit states ──────────────────────────────────────────────────────

  if (tsColIdx < 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
        No datetime column found. The graph view requires a datetime column.
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
        No data to display.
      </div>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const duration   = queryDurationMs >= 1000 ? `${(queryDurationMs / 1000).toFixed(2)}s` : `${queryDurationMs}ms`;
  const bucketName = BUCKET_OPTIONS.find(o => o.ms === data.effectiveBucketMs)?.label ?? `${data.effectiveBucketMs / 1000}s`;
  const avgPerBucket = (data.totalEvents / (data.labels.length || 1)).toFixed(1);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '4px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.05em', fontWeight: 600, color: 'var(--vscode-foreground)' }}>
          Event Timeline
        </h2>
        <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
          {new Date(executedAt).toLocaleTimeString()} · {duration}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>

        {/* Bucket size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap' }}>Bucket</span>
          <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--vscode-editorGroup-border)' }}>
            <BucketBtn label="auto" active={bucketSizeMs === null} onClick={() => setBucketSizeMs(null)} />
            {BUCKET_OPTIONS.map(opt => (
              <BucketBtn key={opt.ms} label={opt.label} active={bucketSizeMs === opt.ms} onClick={() => setBucketSizeMs(opt.ms)} />
            ))}
          </div>
          {bucketSizeMs === null && (
            <span style={{ fontSize: '0.75em', color: 'var(--vscode-descriptionForeground)', opacity: 0.6 }}>
              ({bucketName})
            </span>
          )}
        </div>

        {/* Group by */}
        {groupableCols.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '0.78em', color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap' }}>Group by</span>
            <select
              value={groupByCol}
              onChange={e => setGroupByCol(e.target.value)}
              style={{
                background: 'var(--vscode-dropdown-background, #3c3c3c)',
                color: 'var(--vscode-dropdown-foreground, #cccccc)',
                border: '1px solid var(--vscode-editorGroup-border)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.82em',
                cursor: 'pointer',
              }}
            >
              <option value="">— none —</option>
              {groupableCols.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <StatCard label="Total events" value={data.totalEvents.toLocaleString()} />
        <StatCard label="Time range"   value={`${fmtTime(data.minDate)} – ${fmtTime(data.maxDate)}`} wide />
        <StatCard label={`Peak (${bucketName})`} value={`${data.peakCount.toLocaleString()} @ ${data.peakLabel}`} wide />
        <StatCard label={`Avg / ${bucketName}`}  value={avgPerBucket} />
        <StatCard label="Buckets" value={String(data.labels.length)} />
      </div>

      {/* Chart */}
      <div style={{
        position: 'relative', height: '360px',
        background: 'color-mix(in srgb, var(--vscode-editor-lineHighlightBackground) 35%, transparent)',
        borderRadius: '8px', border: '1px solid var(--vscode-editorGroup-border)',
        padding: '20px 20px 14px 16px',
      }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Footnotes */}
      {data.labels.length > 80 && (
        <div style={{ marginTop: '6px', fontSize: '0.76em', color: 'var(--vscode-descriptionForeground)', textAlign: 'right', opacity: 0.7 }}>
          Point markers hidden ({data.labels.length} data points)
        </div>
      )}
      {groupByCol && data.datasets.length === MAX_GROUPS && (
        <div style={{ marginTop: '4px', fontSize: '0.76em', color: 'var(--vscode-descriptionForeground)', textAlign: 'right', opacity: 0.7 }}>
          Showing top {MAX_GROUPS} groups by event count
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BucketBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px',
        fontSize: '0.78em',
        fontFamily: 'monospace',
        background: active
          ? 'var(--vscode-button-background, #0e639c)'
          : 'var(--vscode-dropdown-background, #3c3c3c)',
        color: active
          ? 'var(--vscode-button-foreground, #ffffff)'
          : 'var(--vscode-descriptionForeground)',
        border: 'none',
        borderRight: '1px solid var(--vscode-editorGroup-border)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

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
      <div style={{ fontSize: '0.72em', color: 'var(--vscode-descriptionForeground)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: '1em', fontWeight: 600, color: 'var(--vscode-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}
