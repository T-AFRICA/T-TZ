"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductSearchHit, SearchResponse, SearchState } from "@tronic/types";
import { ArrowRightIcon, SearchIcon, SlidersIcon, TrendingUpIcon, XIcon } from "@tronic/ui";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { createSearchClient, SEARCH_MAX_QUERY_LENGTH, type SearchClient } from "@tronic/api-client";
import { SearchQuickSheet } from "./SearchQuickSheet";
import { SearchQuickView } from "./SearchQuickView";
import { productHref, SearchResultItem } from "./SearchResultItem";

const DEBOUNCE_MS = 250;
/** Pointer rest time before a hovered row becomes the previewed product. */
const HOVER_INTENT_MS = 90;
const RESULT_LIMIT = 6;
/** Recent responses kept in memory so retyping a query costs no request. */
const CACHE_SIZE = 20;
const SEARCH_PATH = "/search";

/**
 * Where the quick view sits beside the results (desktop, mouse-like pointer,
 * 1024px+). Must match the .search-preview media query in globals.css.
 * Everywhere else a tapped result opens the quick view as a bottom sheet.
 */
const SPLIT_VIEW_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 64rem)";

function subscribeSplitView(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(SPLIT_VIEW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Without matchMedia (tests, very old browsers) behave like desktop: links navigate.
const splitViewSnapshot = () => typeof window.matchMedia !== "function" || window.matchMedia(SPLIT_VIEW_QUERY).matches;
const splitViewServerSnapshot = () => true;

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
 * - Desktop with a mouse (CSS-gated, see .search-preview): a second column
 *   previews the product under the pointer or keyboard highlight, from the
 *   data the search already returned (no request per hover). It opens on
 *   the first result and resets with every new response.
 * - Touch and narrow screens: tapping a result opens the quick view in a
 *   bottom sheet (SearchQuickSheet) instead of leaving the page.
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
  const splitView = useSyncExternalStore(subscribeSplitView, splitViewSnapshot, splitViewServerSnapshot);
  // Touch and narrow screens: the product shown in the quick view sheet.
  const [sheetHit, setSheetHit] = useState<ProductSearchHit | null>(null);
  const onSheetClosed = useCallback(() => setSheetHit(null), []);
  // Product shown in the desktop preview: the last product row made active
  // by hover or keyboard, tied to the response it came from so a new
  // search never shows the previous query's product.
  const [preview, setPreview] = useState<{ response: SearchResponse | null; index: number }>({
    response: null,
    index: 0,
  });
  /** Visible viewport height while the phone keyboard is up (visualViewport). */
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const trimmed = normalise(query);
  const results = response?.results ?? [];
  // Options: each hit, then the "View all results" row.
  const optionCount = state === "results" ? results.length + 1 : 0;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const previewIndex = preview.response === response ? Math.min(preview.index, results.length - 1) : 0;
  const previewHit = state === "results" ? results[previewIndex] : undefined;

  /** Highlights an option; a product option also becomes the previewed product. */
  function activate(index: number) {
    cancelHover();
    setActiveIndex(index);
    if (index >= 0 && index < results.length) {
      setPreview({ response, index });
    }
  }

  // Hover intent: a row takes over only after the pointer rests on it
  // briefly, so sweeping diagonally from a row to the quick view does not
  // switch the product on every row crossed on the way.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelHover() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }
  function hoverOption(index: number) {
    cancelHover();
    hoverTimer.current = setTimeout(() => activate(index), HOVER_INTENT_MS);
  }
  useEffect(() => cancelHover, []);

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
      activate(
        event.key === "ArrowDown"
          ? activeIndex + 1 >= optionCount
            ? 0
            : activeIndex + 1
          : activeIndex <= 0
            ? optionCount - 1
            : activeIndex - 1,
      );
      return;
    }
    if (event.key === "Enter" && isOpen && activeIndex >= 0 && activeIndex < results.length) {
      const hit = results[activeIndex];
      if (hit) {
        event.preventDefault();
        go(productHref(hit));
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

      {/* Escape from anywhere in the panel (e.g. the quick view's buttons)
          closes it and returns focus to the field. Every control inside is
          a native button or link, so this is a shortcut, not a widget. */}
      <div
        onKeyDown={(event) => {
          if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            // Focus first: the field's onFocus opens the panel, close() wins.
            inputRef.current?.focus();
            close();
          }
        }}
        data-open={isOpen}
        data-split={previewHit ? "true" : undefined}
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

        <div className="flex min-h-0 flex-1">
        <div className="search-results min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
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
                    href={productHref(hit)}
                    tabIndex={-1}
                    onClick={(event) => {
                      // Touch / narrow: open the quick view sheet instead of
                      // leaving the page (a modified click still opens a tab).
                      if (!splitView && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                        event.preventDefault();
                        cancelHover();
                        inputRef.current?.blur();
                        setSheetHit(hit);
                        return;
                      }
                      close();
                    }}
                    onMouseEnter={() => hoverOption(index)}
                    onMouseLeave={cancelHover}
                    data-previewed={index === previewIndex ? "true" : undefined}
                    className={`search-row relative flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-100 ${
                      index === activeIndex ? "bg-[var(--surface-card)]" : "hover:bg-[var(--surface-card)]"
                    }`}
                  >
                    <SearchResultItem hit={hit} query={trimmed} />
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
                  onMouseEnter={() => hoverOption(results.length)}
                  onMouseLeave={cancelHover}
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
        {/* Desktop with a fine pointer (CSS: .search-preview): the active
            product's details beside the list. Hidden on touch and narrow
            screens, where rows already carry the essentials. */}
        {previewHit ? (
          <aside aria-label="Quick view" className="search-preview">
            <SearchQuickView hits={results} active={previewHit} onNavigate={close} />
          </aside>
        ) : null}
        </div>
        {response?.simulated && (state === "results" || state === "empty") ? (
          <p className="border-t border-[var(--color-light-grey)] px-4 py-1.5 text-[11px] text-[var(--text-muted)]">
            Sample catalogue — prices and stock are demo values.
          </p>
        ) : null}
      </div>

      <SearchQuickSheet hit={sheetHit} onClosed={onSheetClosed} onNavigate={close} />
    </form>
  );
}
