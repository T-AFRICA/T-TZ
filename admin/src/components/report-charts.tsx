import type { ReactNode } from "react";

/**
 * The Reports page's charts, drawn on the server in plain HTML: no chart
 * library, no script. One hue for a single measure; the fixed categorical
 * order (globals.css --a-chart-*) for the parts of a whole, at most six and
 * the rest as "Other". Every mark has a hover title, every chart a text
 * legend or labels, and the page shows each chart's figures as a table.
 */

/** Fills in the fixed categorical order; written out so Tailwind sees them. */
const SERIES_FILL = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"] as const;
const OTHER_FILL = "bg-chart-other";
const MAX_PARTS = 6;

/** A rounded top for an axis: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * magnitude >= value) return step * magnitude;
  return 10 * magnitude;
}

const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface ColumnPoint {
  key: string;
  /** Short label under the axis ("20 Nov"). */
  label: string;
  value: number;
  /** The hover text: the column's full figures. */
  tip: string;
}

/**
 * Columns over time, one measure, one hue. Rounded data ends on a zero
 * baseline; a recessive grid at half and full height; at most six labels
 * under the axis.
 */
export function ColumnChart({ points, formatTick, label }: { points: ColumnPoint[]; formatTick: (value: number) => string; label: string }) {
  const top = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <figure aria-label={label}>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-48 w-16 shrink-0 text-right text-[11px] tabular-nums text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(top)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatTick(0)}</span>
        </div>
        <div className="relative h-48 min-w-0 flex-1 border-b border-line-strong">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line" />
          <ol className="absolute inset-0 flex items-end gap-[2px]">
            {points.map((point) => (
              <li key={point.key} title={point.tip} className="group flex h-full min-w-0 flex-1 items-end justify-center hover:bg-raised">
                <span className="sr-only">{point.tip}</span>
                <span
                  aria-hidden="true"
                  className="block w-full max-w-8 rounded-t-[4px] bg-chart-1 group-hover:opacity-80"
                  style={{ height: point.value > 0 ? `max(2px, ${percentOf(point.value, top)}%)` : 0 }}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div aria-hidden="true" className="ml-[4.5rem] mt-2 flex text-[11px] text-muted">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {index % every === 0 ? point.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface RankedRow {
  key: string;
  label: ReactNode;
  value: number;
  /** The value as text ("TZS 56,000"). */
  display: string;
  /** A second line under the label ("2 units · SKU-1"). */
  sub?: string;
  tip: string;
}

/** Ranked horizontal bars on a track, largest first, one hue: the longest bar is the largest value. */
export function RankedBars({ rows, label }: { rows: RankedRow[]; label: string }) {
  const top = Math.max(0, ...rows.map((row) => row.value));
  return (
    <ol aria-label={label} className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.key} title={row.tip}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{row.display}</span>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line">
            <div className="h-full rounded-full bg-chart-1" style={{ width: row.value > 0 ? `max(4px, ${percentOf(row.value, top)}%)` : 0 }} />
          </div>
          {row.sub ? <p className="mt-1 text-xs text-muted">{row.sub}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export interface SharePart {
  key: string;
  label: string;
  value: number;
  /** The value as text. */
  display: string;
}

/**
 * Parts of a whole as one tall segmented bar with a legend that names each
 * part with its value and share. The order of `parts` is the colour order,
 * so callers keep it fixed for a fixed set of parts; past six, the smallest
 * fold into "Other".
 */
export function ShareBar({ parts, label, otherDisplay }: { parts: SharePart[]; label: string; otherDisplay?: (value: number) => string }) {
  const shown = parts.filter((part) => part.value > 0);
  let kept = shown;
  let other: SharePart | null = null;
  if (shown.length > MAX_PARTS) {
    const ranked = [...shown].sort((a, b) => b.value - a.value);
    const keep = new Set(ranked.slice(0, MAX_PARTS - 1).map((part) => part.key));
    kept = shown.filter((part) => keep.has(part.key));
    const rest = shown.filter((part) => !keep.has(part.key)).reduce((sum, part) => sum + part.value, 0);
    other = { key: "other", label: `Other (${shown.length - kept.length})`, value: rest, display: otherDisplay ? otherDisplay(rest) : String(rest) };
  }
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  const segments = [...kept.map((part, index) => ({ part, fill: SERIES_FILL[index] ?? OTHER_FILL })), ...(other ? [{ part: other, fill: OTHER_FILL }] : [])];
  const share = (value: number) => {
    const exact = percentOf(value, total);
    return exact > 0 && exact < 1 ? "<1%" : `${Math.round(exact)}%`;
  };

  return (
    <figure aria-label={label}>
      <div aria-hidden="true" className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map(({ part, fill }) => (
          <span key={part.key} title={`${part.label}: ${part.display} (${share(part.value)})`} className={`${fill} min-w-[4px]`} style={{ flexGrow: part.value, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {segments.map(({ part, fill }) => (
          <li key={part.key} className="flex items-center gap-3 py-2.5 text-sm">
            <span aria-hidden="true" className={`${fill} h-2.5 w-2.5 shrink-0 rounded-full`} />
            <span className="min-w-0 flex-1 text-ink [overflow-wrap:anywhere]">{part.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{part.display}</span>
            <span className="w-11 shrink-0 text-right tabular-nums text-muted">{share(part.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A chart's figures as a table, folded under it. */
export function TableView({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-5 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Show the figures as a table</summary>
      <div className="-mx-5 -mb-5 mt-3 border-t border-line">{children}</div>
    </details>
  );
}
