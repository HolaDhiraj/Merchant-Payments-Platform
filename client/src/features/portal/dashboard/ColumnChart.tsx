import { useState } from 'react';
import styles from './Charts.module.css';

export interface Column {
  key: string;
  label: string;
  // Long label for the tooltip and the table view, e.g. "Thu, 30 Oct".
  title: string;
  value: number;
  detail?: string;
}

interface ColumnChartProps {
  columns: Column[];
  formatValue(value: number): string;
  formatTick(value: number): string;
  caption: string;
  highlightKey?: string;
}

// Rounds the axis maximum up to a clean 1/2/2.5/5 × 10^n so ticks read as round numbers.
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= max)!;
  return step * power;
}

// One series over time: thin columns from a shared baseline, a hover/focus tooltip on each,
// and the same numbers in a visually hidden table for screen readers.
export function ColumnChart({ columns, formatValue, formatTick, caption, highlightKey }: ColumnChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(...columns.map((c) => c.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const activeColumn = columns.find((column) => column.key === active);
  const labelEvery = columns.length > 16 ? 3 : columns.length > 10 ? 2 : 1;

  return (
    <figure className={styles.figure}>
      <div className={styles.columnChart}>
        <div className={styles.yAxis} aria-hidden="true">
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{formatTick(tick)}</span>
          ))}
        </div>
        <div className={styles.plot}>
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridline} style={{ bottom: `${(tick / max) * 100}%` }} aria-hidden="true" />
          ))}
          <div className={styles.columns}>
            {columns.map((column, index) => (
              <button
                key={column.key}
                type="button"
                className={styles.slot}
                aria-label={`${column.title}: ${formatValue(column.value)}${column.detail ? `, ${column.detail}` : ''}`}
                onPointerEnter={() => setActive(column.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(column.key)}
                onBlur={() => setActive(null)}
              >
                <span
                  className={styles.column}
                  data-highlight={column.key === highlightKey || undefined}
                  data-active={column.key === active || undefined}
                  style={{ height: column.value > 0 ? `max(${(column.value / max) * 100}%, 3px)` : 0 }}
                />
                <span className={styles.xLabel} aria-hidden="true">
                  {index % labelEvery === 0 || column.key === highlightKey ? column.label : ''}
                </span>
                {column.key === active && activeColumn && (
                  <span className={styles.tooltip} role="tooltip">
                    <strong>{formatValue(activeColumn.value)}</strong>
                    <span>{activeColumn.title}</span>
                    {activeColumn.detail && <span>{activeColumn.detail}</span>}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <tbody>
          {columns.map((column) => (
            <tr key={column.key}>
              <th scope="row">{column.title}</th>
              <td>{formatValue(column.value)}</td>
              {column.detail && <td>{column.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
}

// Ranked horizontal bars: label on the left, value at the bar's tip, in text colours.
export function BarList({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure className={styles.figure}>
      <ul className={styles.barList} aria-label={caption}>
        {rows.map((row) => (
          <li key={row.key} className={styles.barRow} title={row.detail}>
            <span className={styles.barLabel}>{row.label}</span>
            <span className={styles.barTrack}>
              <span className={styles.bar} style={{ width: `max(${(row.value / max) * 100}%, 3px)` }} />
            </span>
            <span className={styles.barValue}>
              {row.valueLabel}
              {row.detail && <span className={styles.barDetail}>{row.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
