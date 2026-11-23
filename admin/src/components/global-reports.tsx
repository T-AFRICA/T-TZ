"use client";

import { Fragment, useId, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, RefreshIcon, SearchIcon, SlidersIcon } from "@tronic/ui";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/forms";
import { setExchangeRateAction } from "@/features/global-reports/actions";

/**
 * One country's US dollar rate, typed by the Master Super Admin. The
 * server action and the database decide whether it is saved; this form
 * only collects the number.
 */
export function ExchangeRateForm({ countryId, countryName, currency, current }: { countryId: string; countryName: string; currency: string; current: string | null }) {
  return (
    <ActionForm action={setExchangeRateAction} className="flex flex-col gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                name="rate"
                label={`${currency} for 1 US dollar`}
                inputMode="decimal"
                autoComplete="off"
                maxLength={20}
                required
                defaultValue={current ?? ""}
                placeholder="For example 2650"
                error={state.fieldErrors?.rate}
                aria-label={`${countryName}: ${currency} for 1 US dollar`}
              />
            </div>
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
          <FormMessage state={state} />
        </>
      )}
    </ActionForm>
  );
}

/**
 * Asks every country again without leaving the page or losing the place on
 * it. A plain link to the same address underneath, so it still works before
 * the script has loaded and in a new tab. Nothing is cached here: the
 * server reads the countries again and checks the administrator again.
 */
export function RefreshLink({ href, className }: { href: string; className: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!pending) start(() => router.refresh());
  }
  return (
    <a href={href} onClick={onClick} aria-busy={pending} className={className}>
      <RefreshIcon size={16} className={pending ? "motion-safe:animate-spin" : ""} />
      Refresh
      <span role="status" className="sr-only">
        {pending ? "Reading the countries again…" : ""}
      </span>
    </a>
  );
}

/**
 * The date range and country fields. On a phone they fold behind one
 * button that says what is chosen; from a tablet up they are always shown
 * and the button is not. The fields themselves are a plain GET form
 * rendered by the server.
 */
export function FilterDrawer({ summary, defaultOpen, children }: { summary: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const panel = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-raised md:hidden"
      >
        <SlidersIcon size={16} className="shrink-0 text-muted" />
        <span className="sr-only">Date range and country: </span>
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <ChevronDownIcon size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={panel} className={`${open ? "block" : "hidden"} w-full md:block md:w-auto`}>
        {children}
      </div>
    </>
  );
}

export interface CountryTableRow {
  id: string;
  /** Lower-case words the search looks in: the name, the ISO code, the currency, the status. */
  search: string;
  /** The row, rendered by the server. */
  node: ReactNode;
}

/**
 * The country comparison table with a search box over it. The search only
 * hides rows that are already on the page: it asks no country again and
 * changes no figure, and the totals row stays the total of every country
 * listed. Head, rows and foot are rendered by the server.
 */
export function CountryTable({ caption, head, rows, foot, columns, hint }: { caption: string; head: ReactNode; rows: CountryTableRow[]; foot: ReactNode; columns: number; hint: string }) {
  const [text, setText] = useState("");
  const needle = text.trim().toLowerCase();
  const shown = needle ? rows.filter((row) => row.search.includes(needle)) : rows;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5">
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search countries</span>
          <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={40}
            autoComplete="off"
            placeholder="Search country or currency"
            className="min-h-9 w-full rounded-lg border border-line-strong bg-surface py-1.5 pl-9 pr-3 text-sm text-ink transition-colors placeholder:text-muted hover:border-muted focus:border-ink"
          />
        </label>
        <p role="status" className="text-xs text-muted">
          {needle ? `${shown.length} of ${rows.length} ${rows.length === 1 ? "country" : "countries"} shown` : hint}
        </p>
      </div>
      <div className="table-scroll">
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>{head}</thead>
          <tbody className="divide-y divide-line">
            {shown.map((row) => (
              <Fragment key={row.id}>{row.node}</Fragment>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns} className="px-5 py-8 text-center text-sm text-muted">
                  No country matches “{text.trim()}”. The totals below are still for every country listed.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>{foot}</tfoot>
        </table>
      </div>
    </>
  );
}
