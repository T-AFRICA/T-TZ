import { useId, type ReactNode } from "react";
import { niceMax } from "@/components/report-charts";

/**
 * Charts of the Global Combined Reports, drawn on the server in HTML and
 * SVG: no chart library, no script. Same rules as report-charts.tsx: a
 * country keeps its colour wherever it appears (its place in the fixed
 * categorical order, never its rank), every mark shows its figures when
 * pointed at and says the same words to screen readers, every chart has
 * labels or a legend in text ink, and the page shows the figures as a
 * table too.
 */

const FILL = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"] as const;
const STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5", "stroke-chart-6"] as const;
const TOKEN = ["--a-chart-1", "--a-chart-2", "--a-chart-3", "--a-chart-4", "--a-chart-5", "--a-chart-6"] as const;
const OTHER_FILL = "bg-chart-other";
const OTHER_STROKE = "stroke-chart-other";
const OTHER_TOKEN = "--a-chart-other";

/** The fill of the series at `index` in the fixed order; grey past the sixth. */
export const seriesFill = (index: number): string => FILL[index] ?? OTHER_FILL;
const seriesStroke = (index: number): string => STROKE[index] ?? OTHER_STROKE;
const seriesToken = (index: number): string => TOKEN[index] ?? OTHER_TOKEN;

const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * The card shown beside a mark while the pointer is on it (its parent is a
 * `group`). Decorative for assistive technology: the same words are in the
 * mark's own visually hidden text.
 */
function Tip({ heading, lines, side = "centre", place = "top-1" }: { heading: string; lines: string[]; side?: "left" | "centre" | "right"; place?: string }) {
  const across = side === "left" ? "left-0" : side === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-20 hidden whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs leading-snug shadow-panel group-hover:block ${place} ${across}`}
    >
      <span className="block font-semibold text-ink">{heading}</span>
      {lines.map((line, index) => (
        <span key={index} className="block tabular-nums text-muted">
          {line}
        </span>
      ))}
    </span>
  );
}

/** Which side of a mark its card opens on, so it stays inside the chart at either end. */
const sideOf = (index: number, length: number): "left" | "centre" | "right" => (length < 3 ? "centre" : index < length / 3 ? "left" : index >= (length * 2) / 3 ? "right" : "centre");

/** The words above a chart's value axis: what is measured and in what unit. */
function AxisTitle({ children }: { children: ReactNode }) {
  return (
    <p aria-hidden="true" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </p>
  );
}

export interface SeriesValue {
  key: string;
  label: string;
  /** The entity's place in the fixed colour order. */
  series: number;
  value: number;
  display: string;
}

export interface ColumnItem {
  key: string;
  label: string;
  /** The entity's place in the fixed colour order. */
  series: number;
  /** Null when the country has no figure for this chart; `missing` says why. */
  value: number | null;
  /** The value as short text above the column ("$1.2K"). */
  display: string;
  /** Exact lines for the pointer card ("$1,204.50", "62.0% of the total"). */
  detail: string[];
  /** Two or three words under an empty slot ("No rate", "Not connected"). */
  missing?: string;
}

/**
 * One column per country, the value above it, the name under it. A country
 * without a figure keeps its place on the axis with the reason in words, so
 * a missing column is never read as a zero.
 */
export function CountryColumns({ items, formatTick, label, axis }: { items: ColumnItem[]; formatTick: (value: number) => string; label: string; axis: string }) {
  const top = niceMax(Math.max(0, ...items.map((item) => item.value ?? 0)));
  return (
    <figure aria-label={label}>
      <AxisTitle>{axis}</AxisTitle>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-56 w-12 shrink-0 text-right text-[11px] tabular-nums text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(top)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatTick(0)}</span>
        </div>
        <div className="relative h-56 min-w-0 flex-1 border-b border-line-strong">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
          <ol className="absolute inset-0 flex items-end justify-around gap-2 px-1">
            {items.map((item, index) =>
              item.value === null ? (
                <li key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="sr-only">{`${item.label}: ${item.missing ?? "no figure"}`}</span>
                  <span aria-hidden="true" className="mb-1 text-center text-[10px] leading-tight text-muted">
                    {item.missing}
                  </span>
                  <span aria-hidden="true" className="block h-1.5 w-full max-w-14 rounded-t-[3px] border border-b-0 border-dashed border-line-strong" />
                </li>
              ) : (
                <li key={item.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md hover:bg-raised/70">
                  <span className="sr-only">{`${item.label}: ${item.detail.join(", ")}`}</span>
                  <Tip heading={item.label} lines={item.detail} side={sideOf(index, items.length)} />
                  <span aria-hidden="true" className="mb-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink">
                    {item.display}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`block w-full max-w-14 rounded-t-[4px] ${seriesFill(item.series)}`}
                    style={{ height: item.value > 0 ? `max(2px, ${percentOf(item.value, top) * 0.88}%)` : 0 }}
                  />
                </li>
              ),
            )}
          </ol>
        </div>
      </div>
      <div aria-hidden="true" className="ml-14 mt-2 flex justify-around gap-2 px-1 text-[11px] font-medium text-ink">
        {items.map((item) => (
          <span key={item.key} className={`min-w-0 flex-1 truncate text-center ${item.value === null ? "text-muted" : ""}`}>
            {item.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface LinePoint {
  key: string;
  /** Short label under the axis ("20 Nov"). */
  label: string;
  value: number;
  /** The pointer card: the day in full and its figure. */
  heading: string;
  detail: string;
}

/**
 * One measure over time: a 2px line over a faint area, a zero baseline, at
 * most six labels under the axis, and a rule with the day's figure under
 * the pointer. `whole` is for counts: the axis then never shows half an
 * order.
 */
export function LineChart({ points, formatTick, label, axis, whole = false }: { points: LinePoint[]; formatTick: (value: number) => string; label: string; axis: string; whole?: boolean }) {
  const area = useId();
  const nice = niceMax(Math.max(0, ...points.map((point) => point.value)));
  // A count's axis ends on an even number, so its middle line is a whole number too.
  const top = whole && nice > 1 && nice % 2 === 1 ? nice + 1 : nice;
  const halfShown = !whole || Number.isInteger(top / 2);
  const every = Math.max(1, Math.ceil(points.length / 6));
  const x = (index: number) => (points.length > 1 ? (index / (points.length - 1)) * 100 : 50);
  const y = (value: number) => 100 - percentOf(value, top);
  const line = points.map((point, index) => `${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const peak = points.reduce<number>((best, point, index) => (point.value > (points[best]?.value ?? -1) ? index : best), 0);
  return (
    <figure aria-label={label}>
      <AxisTitle>{axis}</AxisTitle>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-56 w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(top)}</span>
          {halfShown ? <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(top / 2)}</span> : null}
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatTick(0)}</span>
        </div>
        <div className="relative h-56 min-w-0 flex-1 border-b border-line-strong">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
          {halfShown ? <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" /> : null}
          {points.length > 1 ? (
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--a-chart-1)" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="var(--a-chart-1)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={`0,100 ${line} 100,100`} fill={`url(#${area})`} />
              <polyline points={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-chart-1" />
            </svg>
          ) : null}
          <ol className="absolute inset-0 flex">
            {points.map((point, index) => (
              <li key={point.key} className="group relative h-full min-w-0 flex-1">
                <span className="sr-only">{`${point.heading}: ${point.detail}`}</span>
                {/* The rule under the pointer. */}
                <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-line-strong group-hover:block" />
                {/* A marker on the busiest day, and on the day under the pointer. */}
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-surface ${index === peak && point.value > 0 ? "" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ bottom: `${percentOf(point.value, top)}%` }}
                />
                <Tip heading={point.heading} lines={[point.detail]} side={sideOf(index, points.length)} />
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div aria-hidden="true" className="ml-12 mt-2 flex text-[11px] text-muted">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {index % every === 0 ? point.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Parts of a whole as a ring, the total in the middle and a legend that
 * names each part with its value and share. A gap of the surface separates
 * the parts.
 */
export function Donut({ parts, label, centre, centreLabel }: { parts: SeriesValue[]; label: string; centre: string; centreLabel: string }) {
  const shown = parts.filter((part) => part.value > 0);
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  const gap = shown.length > 1 ? 1 : 0;
  let start = 0;
  const arcs = shown.map((part) => {
    const share = percentOf(part.value, total);
    const arc = { part, share, start };
    start += share;
    return arc;
  });
  const shareText = (share: number) => `${share.toFixed(share < 10 ? 1 : 0)}%`;
  return (
    <figure aria-label={label} className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg aria-hidden="true" viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="46" fill="none" strokeWidth="16" className="stroke-raised" />
          {arcs.map(({ part, share, start: offset }) => (
            <circle
              key={part.key}
              cx="60"
              cy="60"
              r="46"
              fill="none"
              strokeWidth="16"
              pathLength={100}
              strokeDasharray={`${Math.max(share - gap, 0.5)} ${100 - Math.max(share - gap, 0.5)}`}
              strokeDashoffset={-offset}
              className={`${seriesStroke(part.series)} transition-opacity hover:opacity-80`}
            >
              <title>{`${part.label}: ${part.display} (${shareText(share)})`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-lg leading-tight tabular-nums text-ink">{centre}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{centreLabel}</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-y-2.5">
        {arcs.map(({ part, share }) => (
          <li key={part.key} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden="true" className={`${seriesFill(part.series)} inline-block h-2.5 w-2.5 shrink-0 rounded-sm`} />
            <span className="min-w-0 flex-1 font-medium text-ink [overflow-wrap:anywhere]">{part.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{part.display}</span>
            <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-ink">{shareText(share)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface StackRow {
  key: string;
  label: string;
  /** One value per segment name, in the same order as `segments`. */
  values: number[];
}

/**
 * One bar per country, split into the same named segments; the legend names
 * them once and gives each one's total. `fills` sets a colour per segment
 * when the segments are states rather than series.
 */
export function StackedBars({ rows, segments, label, fills }: { rows: StackRow[]; segments: string[]; label: string; fills?: string[] }) {
  const top = Math.max(0, ...rows.map((row) => row.values.reduce((sum, value) => sum + value, 0)));
  const fill = (index: number) => fills?.[index] ?? seriesFill(index);
  const whole = (value: number) => value.toLocaleString("en-US");
  return (
    <figure aria-label={label}>
      <ul aria-hidden="true" className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {segments.map((segment, index) => (
          <li key={segment} className="flex items-center gap-1.5">
            <span className={`${fill(index)} inline-block h-2.5 w-2.5 rounded-sm`} />
            {segment}
            <span className="font-semibold tabular-nums text-ink">{whole(rows.reduce((sum, row) => sum + (row.values[index] ?? 0), 0))}</span>
          </li>
        ))}
      </ul>
      <ol className="flex flex-col gap-4">
        {rows.map((row) => {
          const total = row.values.reduce((sum, value) => sum + value, 0);
          const lines = segments.map((segment, index) => `${segment}: ${whole(row.values[index] ?? 0)}`);
          return (
            <li key={row.key} className="group relative">
              <span className="sr-only">{`${row.label}: ${lines.join(", ")}`}</span>
              <Tip heading={row.label} lines={lines} side="right" place="top-full mt-1" />
              <div aria-hidden="true" className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{row.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  <span className="font-semibold text-ink">{whole(total)}</span> {total === 1 ? "order" : "orders"}
                </span>
              </div>
              {total > 0 ? (
                <div aria-hidden="true" className="mt-1.5 flex h-3.5 gap-[2px]" style={{ width: `max(6px, ${percentOf(total, top)}%)` }}>
                  {row.values.map((value, index) =>
                    value > 0 ? <span key={segments[index]} className={`${fill(index)} min-w-[2px] rounded-[3px]`} style={{ flexGrow: value, flexBasis: 0 }} /> : null,
                  )}
                </div>
              ) : (
                <div aria-hidden="true" className="mt-1.5 h-3.5 rounded-[3px] border border-dashed border-line-strong" />
              )}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** A small line of a country's daily sales, in the country's own colour: the shape only, no axis. The figures are in the card beside it. */
export function Sparkline({ values, label, series }: { values: number[]; label: string; series: number }) {
  const area = useId();
  const top = Math.max(0, ...values);
  if (values.length < 2 || top === 0) {
    return (
      <div role="img" aria-label={`${label}: no sales in the period`} className="grid h-10 place-items-center rounded-md border border-dashed border-line text-[11px] text-muted">
        No paid sales in the period
      </div>
    );
  }
  const points = values.map((value, index) => `${((index / (values.length - 1)) * 100).toFixed(2)},${(100 - (value / top) * 88 - 6).toFixed(2)}`).join(" ");
  const colour = `var(${seriesToken(series)})`;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full overflow-visible">
      <defs>
        <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.24" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#${area})`} />
      <polyline points={points} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className={seriesStroke(series)} />
    </svg>
  );
}
