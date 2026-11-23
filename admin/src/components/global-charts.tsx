import { niceMax } from "@/components/report-charts";

/**
 * Charts of the Global Combined Reports, drawn on the server in HTML and
 * SVG: no chart library, no script. Same rules as report-charts.tsx: a
 * country keeps its colour wherever it appears (its place in the fixed
 * categorical order, never its rank), every mark has a hover title and the
 * same words for screen readers, every chart has labels or a legend in text
 * ink, and the page shows the figures as a table too.
 */

const FILL = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"] as const;
const STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5", "stroke-chart-6"] as const;
const OTHER_FILL = "bg-chart-other";
const OTHER_STROKE = "stroke-chart-other";

/** The fill of the series at `index` in the fixed order; grey past the sixth. */
export const seriesFill = (index: number): string => FILL[index] ?? OTHER_FILL;
const seriesStroke = (index: number): string => STROKE[index] ?? OTHER_STROKE;

const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface SeriesValue {
  key: string;
  label: string;
  /** The entity's place in the fixed colour order. */
  series: number;
  value: number;
  display: string;
}

/** One column per country, the value above it, the name under it. */
export function CountryColumns({ items, formatTick, label }: { items: SeriesValue[]; formatTick: (value: number) => string; label: string }) {
  const top = niceMax(Math.max(0, ...items.map((item) => item.value)));
  return (
    <figure aria-label={label}>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-52 w-14 shrink-0 text-right text-[11px] tabular-nums text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(top)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatTick(0)}</span>
        </div>
        <div className="relative h-52 min-w-0 flex-1 border-b border-line-strong">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line" />
          <ol className="absolute inset-0 flex items-end justify-around gap-2 px-1">
            {items.map((item) => (
              <li key={item.key} title={`${item.label}: ${item.display}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className="sr-only">{`${item.label}: ${item.display}`}</span>
                <span aria-hidden="true" className="mb-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink">
                  {item.display}
                </span>
                <span
                  aria-hidden="true"
                  className={`block w-full max-w-14 rounded-t-[4px] ${seriesFill(item.series)}`}
                  style={{ height: item.value > 0 ? `max(2px, ${percentOf(item.value, top) * 0.88}%)` : 0 }}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div aria-hidden="true" className="ml-16 mt-2 flex justify-around gap-2 px-1 text-[11px] text-muted">
        {items.map((item) => (
          <span key={item.key} className="min-w-0 flex-1 truncate text-center">
            {item.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface LinePoint {
  key: string;
  label: string;
  value: number;
  tip: string;
}

/** One measure over time: a 2px line over a faint area, a zero baseline, at most six labels under the axis. */
export function LineChart({ points, formatTick, label }: { points: LinePoint[]; formatTick: (value: number) => string; label: string }) {
  const top = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const every = Math.max(1, Math.ceil(points.length / 6));
  const x = (index: number) => (points.length > 1 ? (index / (points.length - 1)) * 100 : 50);
  const y = (value: number) => 100 - percentOf(value, top);
  const line = points.map((point, index) => `${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const peak = points.reduce<number>((best, point, index) => (point.value > (points[best]?.value ?? -1) ? index : best), 0);
  return (
    <figure aria-label={label}>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-52 w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatTick(top)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatTick(top / 2)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">{formatTick(0)}</span>
        </div>
        <div className="relative h-52 min-w-0 flex-1 border-b border-line-strong">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line" />
          {points.length > 1 ? (
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <polygon points={`0,100 ${line} 100,100`} className="fill-chart-1 opacity-10" />
              <polyline points={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-chart-1" />
            </svg>
          ) : null}
          <ol className="absolute inset-0 flex">
            {points.map((point, index) => (
              <li key={point.key} title={point.tip} className="group relative h-full min-w-0 flex-1 hover:bg-raised/60">
                <span className="sr-only">{point.tip}</span>
                {/* A marker on the busiest day, and on the day under the pointer. */}
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-surface ${index === peak && point.value > 0 ? "" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ bottom: `${percentOf(point.value, top)}%` }}
                />
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
 * names each part with its value and share. A 2-unit gap of the surface
 * separates the parts.
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
    <figure aria-label={label} className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg aria-hidden="true" viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {arcs.map(({ part, share, start: offset }) => (
            <circle
              key={part.key}
              cx="60"
              cy="60"
              r="46"
              fill="none"
              strokeWidth="18"
              pathLength={100}
              strokeDasharray={`${Math.max(share - gap, 0.5)} ${100 - Math.max(share - gap, 0.5)}`}
              strokeDashoffset={-offset}
              className={seriesStroke(part.series)}
            >
              <title>{`${part.label}: ${part.display} (${shareText(share)})`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-bold tabular-nums text-ink">{centre}</p>
            <p className="text-[11px] text-muted">{centreLabel}</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-y-2">
        {arcs.map(({ part, share }) => (
          <li key={part.key} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden="true" className={`${seriesFill(part.series)} inline-block h-3 w-3 shrink-0 translate-y-0.5 rounded-sm`} />
            <span className="min-w-0 flex-1 text-ink [overflow-wrap:anywhere]">{part.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{part.display}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-muted">{shareText(share)}</span>
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

/** One bar per country, split into the same named segments; the legend names them once. */
export function StackedBars({ rows, segments, label }: { rows: StackRow[]; segments: string[]; label: string }) {
  const top = Math.max(0, ...rows.map((row) => row.values.reduce((sum, value) => sum + value, 0)));
  return (
    <figure aria-label={label}>
      <ul aria-hidden="true" className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {segments.map((segment, index) => (
          <li key={segment} className="flex items-center gap-1.5">
            <span className={`${seriesFill(index)} inline-block h-2.5 w-2.5 rounded-sm`} />
            {segment}
          </li>
        ))}
      </ul>
      <ol className="flex flex-col gap-3.5">
        {rows.map((row) => {
          const total = row.values.reduce((sum, value) => sum + value, 0);
          const tip = `${row.label}: ${segments.map((segment, index) => `${segment} ${(row.values[index] ?? 0).toLocaleString("en-US")}`).join(", ")}`;
          return (
            <li key={row.key} title={tip}>
              <span className="sr-only">{tip}</span>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{total.toLocaleString("en-US")}</span>
              </div>
              <div aria-hidden="true" className="mt-1.5 flex h-3 gap-[2px]" style={{ width: total > 0 ? `max(6px, ${percentOf(total, top)}%)` : 0 }}>
                {row.values.map((value, index) =>
                  value > 0 ? <span key={segments[index]} className={`${seriesFill(index)} min-w-[2px] rounded-[2px]`} style={{ flexGrow: value, flexBasis: 0 }} /> : null,
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** A small line of a country's daily sales: the shape only, no axis. The figures are in the card beside it. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const top = Math.max(0, ...values);
  if (values.length < 2 || top === 0) return <div role="img" aria-label={`${label}: no sales in the period`} className="h-9 rounded bg-raised" />;
  const points = values.map((value, index) => `${((index / (values.length - 1)) * 100).toFixed(2)},${(100 - (value / top) * 92 - 4).toFixed(2)}`).join(" ");
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 100" preserveAspectRatio="none" className="h-9 w-full overflow-visible">
      <polyline points={points} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-accent" />
    </svg>
  );
}
