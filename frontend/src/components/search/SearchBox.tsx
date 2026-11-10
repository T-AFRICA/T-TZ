"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductSearchHit, SearchResponse, SearchState } from "@tronic/types";
import { ArrowRightIcon, ChevronRightIcon, SearchIcon, SlidersIcon, TrendingUpIcon, XIcon } from "@tronic/ui";
import { ACTIVE_COUNTRY, CATEGORY_SECTIONS, formatMoney } from "@tronic/country-config";
import { createSearchClient, SEARCH_MAX_QUERY_LENGTH, type SearchClient } from "@tronic/api-client";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 6;
/** Recent responses kept in memory so retyping a query costs no request. */
const CACHE_SIZE = 20;
const SEARCH_PATH = "/search";

/** Quick links shown while the field is focused but empty. */
const POPULAR_CATEGORIES = CATEGORY_SECTIONS.slice(0, 6).map((section) => ({
  name: section.name,
  href: `/categories/${section.slug}`,
}));

export interface SearchBoxProps {
  /** Injectable for tests; defaults to the storefront's GET /api/search. */
  client?: SearchClient;
}

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
}

function searchUrl(query: string): string {
  return `${SEARCH_PATH}?${new URLSearchParams({ q: query }).toString()}`;
}

/** Wraps the parts of the name that match a query word in <mark>; plain text, never HTML. */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const tokens = [...new Set(query.toLowerCase().split(" ").filter((token) => token.length > 0))];
  if (tokens.length === 0) {
    return <>{name}</>;
  }
  const lower = name.toLowerCase();
  const marked = new Array<boolean>(name.length).fill(false);
  for (const token of tokens) {
    let at = lower.indexOf(token);
    while (at !== -1) {
      marked.fill(true, at, at + token.length);
      at = lower.indexOf(token, at + token.length);
    }
  }
  const parts: React.ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= name.length; i += 1) {
    if (i === name.length || marked[i] !== marked[start]) {
      const text = name.slice(start, i);
      parts.push(
        marked[start] ? (
          <mark key={start} className="bg-transparent font-bold text-inherit">
            {text}
          </mark>
        ) : (
          text
        ),
      );
      start = i;
    }
  }
  return <>{parts}</>;
}

function ResultRow({ hit, query }: { hit: ProductSearchHit; query: string }) {
  const onSale = hit.wasPrice !== undefined && hit.wasPrice > hit.price;
  return (
    <>
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-light-grey)] bg-white md:h-16 md:w-16">
        <Image src={hit.image} alt="" fill sizes="64px" className="object-contain p-1.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
          <HighlightedName name={hit.name} query={query} />
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
          SKU {hit.sku} · {hit.categoryName}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        <span
          className={`text-[13px] font-bold ${onSale ? "text-[var(--color-action-red)]" : "text-[var(--color-premium-black)]"}`}
        >
          {formatMoney(hit.price, ACTIVE_COUNTRY, hit.currency)}
        </span>
        {onSale && hit.wasPrice !== undefined ? (
          <span className="text-[11px] text-[var(--text-muted)] line-through">
            {formatMoney(hit.wasPrice, ACTIVE_COUNTRY, hit.currency)}
          </span>
        ) : null}
        <span
          className={`mt-0.5 text-[11px] font-medium ${hit.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"}`}
        >
          {hit.inStock ? "In stock" : "Out of stock"}
        </span>
      </span>
      <ChevronRightIcon size={16} className="shrink-0 text-[var(--text-muted)] max-sm:hidden" />
    </>
  );
}

function SkeletonRows() {
  return (
    <ul aria-hidden="true" className="space-y-1 p-2">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-[var(--color-light-grey)]/70 md:h-16 md:w-16" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-3/4 animate-pulse rounded bg-[var(--color-light-grey)]/70" />
            <span className="block h-2.5 w-1/2 animate-pulse rounded bg-[var(--color-light-grey)]/50" />
          </span>
          <span className="h-3 w-16 animate-pulse rounded bg-[var(--color-light-grey)]/70" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Header product search (SRS FR-006), upgraded 2026-11-10: a WAI-ARIA
 * combobox whose listbox shows up to six product hits (photo, name, SKU,
 * category, TZS price with any sale price, stock) plus "View all results".
 *
 * - Debounced (250 ms); each new query aborts the previous request, so a
 *   slow, stale response can never overwrite a newer one. Recent responses
 *   are cached in memory.
 * - Arrow keys move through the hits and the "View all" row, Enter opens
 *   the highlighted one, or the full /search page when nothing is
 *   highlighted. It is a real GET form, so Enter works before hydration.
 * - Escape or a click outside closes the panel; focus stays in the field.
 * - The browser only receives the slim hits from /api/search, never the
 *   catalogue. Search text is rendered as text, never as HTML.
 */
export function SearchBox({ client }: SearchBoxProps) {
  const searchClient = useMemo(() => client ?? createSearchClient("http"), [client]);
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const cacheRef = useRef(new Map<string, SearchResponse>());

  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Visible viewport height while the phone keyboard is up (visualViewport). */
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const trimmed = normalise(query);
  const results = response?.results ?? [];
  // Options: each hit, then the "View all results" row.
  const optionCount = state === "results" ? results.length + 1 : 0;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useEffect(() => {
    if (trimmed.length === 0) {
      setState("idle");
      setResponse(null);
      setActiveIndex(-1);
      return;
    }
    const key = trimmed.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResponse(cached);
      setState(cached.results.length > 0 ? "results" : "empty");
      setActiveIndex(-1);
      return;
    }
    setState("loading");
    setActiveIndex(-1);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchClient
        .search(trimmed, { signal: controller.signal, limit: RESULT_LIMIT })
        .then((next) => {
          if (controller.signal.aborted) return;
          const cache = cacheRef.current;
          cache.set(key, next);
          if (cache.size > CACHE_SIZE) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
          setResponse(next);
          setState(next.results.length > 0 ? "results" : "empty");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            return;
          }
          setState("error");
          setResponse(null);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, searchClient]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Phones: keep the panel above the on-screen keyboard by sizing it to the
  // visual viewport while it is open.
  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!isOpen || !viewport) {
      setViewportHeight(null);
      return;
    }
    // Only when the keyboard has actually shrunk the visible area; otherwise
    // the stylesheet's limit (which clears the bottom tab bar) applies.
    const update = () =>
      setViewportHeight(viewport.height < window.innerHeight - 80 ? viewport.height : null);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, [isOpen]);

  // "/" focuses search from anywhere outside a text field (common storefront
  // affordance; harmless on touch devices, which never emit it).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        // Never steal focus out of an open modal (drawer, quick-select).
        target?.closest("dialog[open]")
      ) {
        return;
      }
      const input = inputRef.current;
      if (!input || input.offsetParent === null) {
        return; // this instance is hidden at the current breakpoint
      }
      event.preventDefault();
      input.focus();
      setIsOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function clearQuery() {
    setQuery("");
    setIsOpen(true);
    inputRef.current?.focus();
  }

  function go(href: string) {
    close();
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!isOpen) {
        setIsOpen(true);
      }
      if (optionCount === 0) {
        return;
      }
      event.preventDefault();
      setActiveIndex((index) =>
        event.key === "ArrowDown"
          ? index + 1 >= optionCount
            ? 0
            : index + 1
          : index <= 0
            ? optionCount - 1
            : index - 1,
      );
      return;
    }
    if (event.key === "Enter" && isOpen && activeIndex >= 0 && activeIndex < results.length) {
      const hit = results[activeIndex];
      if (hit) {
        event.preventDefault();
        go(`/products/${encodeURIComponent(hit.slug)}`);
      }
    }
    // Otherwise Enter submits the form: the full results page.
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length === 0) {
      inputRef.current?.focus();
      setIsOpen(true);
      return;
    }
    go(searchUrl(trimmed));
  }

  const hasQuery = query.length > 0;
  const listboxShown = isOpen && state === "results";
  const announce =
    state === "results" && response
      ? `${response.total} ${response.total === 1 ? "product" : "products"} found`
      : state === "empty"
        ? "No products found"
        : "";

  return (
    <form
      ref={rootRef}
      role="search"
      action={SEARCH_PATH}
      method="get"
      onSubmit={onSubmit}
      className="relative w-full max-w-2xl"
    >
      <label htmlFor={`${baseId}-input`} className="sr-only">
        Search products
      </label>
      <input
        ref={inputRef}
        id={`${baseId}-input`}
        name="q"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listboxShown}
        aria-controls={listboxShown ? listboxId : undefined}
        aria-activedescendant={listboxShown && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={SEARCH_MAX_QUERY_LENGTH}
        placeholder="Search products, SKU or model…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        className={`h-11 w-full rounded-full border [&::-webkit-search-cancel-button]:hidden border-[var(--color-light-grey)] bg-white pl-5 text-sm transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] hover:border-[var(--color-mid-grey)] focus:border-[var(--color-action-red)] focus:shadow-[0_0_0_3px_rgba(239,28,38,0.12)] max-md:rounded-xl max-md:border-transparent max-md:pl-11 max-md:shadow-sm max-md:focus:border-[var(--color-action-red)] ${
          hasQuery ? "pr-20" : "pr-14"
        }`}
      />
      {/* Leading icon on the mobile pill (approved mobile UI reference) */}
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] md:hidden"
      />
      {hasQuery ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clearQuery}
          className="absolute right-12 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]"
        >
          <XIcon size={16} />
        </button>
      ) : null}
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 top-1/2 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors max-md:text-[var(--text-secondary)] max-md:hover:text-[var(--text-primary)] md:bg-[var(--color-action-red)] md:text-white md:hover:bg-[var(--color-action-red-dark)]"
      >
        {/* Mobile shows a filter-style affordance (approved UI reference). */}
        <SearchIcon size={18} className="max-md:hidden" />
        <SlidersIcon size={19} className="md:hidden" />
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div
        data-open={isOpen}
        className="search-panel absolute left-0 right-0 top-full z-50 md:right-auto md:w-[max(100%,30rem)] mt-2 flex flex-col overflow-hidden rounded-2xl border border-[var(--color-light-grey)] bg-white shadow-[0_18px_48px_-12px_rgba(17,17,17,0.25)]"
        style={
          {
            "--search-panel-max": viewportHeight
              ? `min(32rem, calc(${viewportHeight}px - 9.5rem))`
              : undefined,
          } as React.CSSProperties
        }
      >
        {/* Phones: an explicit close action at the top of the panel. */}
        <div className="flex items-center justify-between border-b border-[var(--color-light-grey)] px-4 py-2 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {trimmed.length > 0 ? "Products" : "Popular categories"}
          </span>
          <button
            type="button"
            onClick={() => {
              close();
              inputRef.current?.blur();
            }}
            className="rounded-full px-3 py-1 text-[13px] font-semibold text-[var(--color-action-red)]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {state === "idle" ? (
            <nav aria-label="Popular categories" className="py-2">
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] max-md:hidden">
                Popular categories
              </p>
              <ul>
                {POPULAR_CATEGORIES.map((category) => (
                  <li key={category.href + category.name}>
                    <Link
                      href={category.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-card)]"
                      onClick={close}
                    >
                      <TrendingUpIcon size={16} className="shrink-0 text-[var(--text-muted)]" />
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          {state === "loading" ? (
            <div>
              <p className="sr-only">Searching…</p>
              <SkeletonRows />
            </div>
          ) : null}
          {state === "error" ? (
            <p role="alert" className="px-4 py-4 text-sm text-[var(--color-action-red)]">
              Search is unavailable right now. Please try again.
            </p>
          ) : null}
          {state === "empty" ? (
            <div className="px-4 py-5 text-sm">
              <p className="font-semibold text-[var(--text-primary)]">No products match “{trimmed}”.</p>
              <p className="mt-1 text-[var(--text-muted)]">
                Check the spelling, try fewer words, or search by SKU.
              </p>
            </div>
          ) : null}
          {state === "results" ? (
            <ul id={listboxId} role="listbox" aria-label="Product suggestions" className="p-2">
              {results.map((hit, index) => (
                <li key={hit.id} id={optionId(index)} role="option" aria-selected={index === activeIndex}>
                  <Link
                    href={`/products/${encodeURIComponent(hit.slug)}`}
                    tabIndex={-1}
                    onClick={close}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
                      index === activeIndex ? "bg-[var(--surface-card)]" : "hover:bg-[var(--surface-card)]"
                    }`}
                  >
                    <ResultRow hit={hit} query={trimmed} />
                  </Link>
                </li>
              ))}
              <li
                id={optionId(results.length)}
                role="option"
                aria-selected={activeIndex === results.length}
                className="mt-1 border-t border-[var(--color-light-grey)] pt-1"
              >
                <Link
                  href={searchUrl(trimmed)}
                  tabIndex={-1}
                  onClick={close}
                  onMouseEnter={() => setActiveIndex(results.length)}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--color-action-red)] transition-colors ${
                    activeIndex === results.length ? "bg-[var(--surface-card)]" : "hover:bg-[var(--surface-card)]"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    View all {response && response.total > results.length ? `${response.total} ` : ""}results
                    for “{trimmed}”
                  </span>
                  <ArrowRightIcon size={15} className="shrink-0" />
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
        {response?.simulated && (state === "results" || state === "empty") ? (
          <p className="border-t border-[var(--color-light-grey)] px-4 py-1.5 text-[11px] text-[var(--text-muted)]">
            Sample catalogue — prices and stock are demo values.
          </p>
        ) : null}
      </div>
    </form>
  );
}
