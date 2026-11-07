"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SearchResultItem, SearchState } from "@tronic/types";
import { SearchIcon, SlidersIcon, TrendingUpIcon, XIcon } from "@tronic/ui";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { createSearchClient, type SearchClient } from "@tronic/api-client";

const DEBOUNCE_MS = 300;

/** Quick links shown while the field is focused but empty. */
const POPULAR_CATEGORIES = CATEGORY_SECTIONS.slice(0, 6).map((section) => ({
  name: section.name,
  href: `/categories/${section.slug}`,
}));

export interface SearchBoxProps {
  /** Injectable for tests; defaults to the mock adapter (live lands W09+). */
  client?: SearchClient;
}

/** Bolds the parts of a suggestion title that match the typed query. */
function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const needle = query.trim();
  if (needle.length === 0) {
    return <>{title}</>;
  }
  const lowerTitle = title.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let matchAt = lowerTitle.indexOf(lowerNeedle);
  while (matchAt !== -1) {
    if (matchAt > cursor) {
      parts.push(title.slice(cursor, matchAt));
    }
    parts.push(
      <mark key={matchAt} className="bg-transparent font-semibold text-inherit">
        {title.slice(matchAt, matchAt + needle.length)}
      </mark>,
    );
    cursor = matchAt + needle.length;
    matchAt = lowerTitle.indexOf(lowerNeedle, cursor);
  }
  if (cursor < title.length) {
    parts.push(title.slice(cursor));
  }
  return <>{parts}</>;
}

/**
 * Header search shell (SRS FR-006): an accessible combobox with debounced
 * querying and explicit idle / loading / results / empty / error states.
 * While the field is empty it offers popular category shortcuts; results
 * come from the mock adapter and are labelled as sample data.
 */
export function SearchBox({ client }: SearchBoxProps) {
  const searchClient = useMemo(() => client ?? createSearchClient("mock"), [client]);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setState("idle");
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    setState("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchClient
        .search(trimmed, { signal: controller.signal })
        .then((response) => {
          setResults(response.results);
          setState(response.results.length > 0 ? "results" : "empty");
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setState("error");
          setResults([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, searchClient]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

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
      event.preventDefault();
      inputRef.current?.focus();
      setIsOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function clearQuery() {
    setQuery("");
    setIsOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (state !== "results") {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      // Enter follows the highlighted suggestion, or the top one when the
      // shopper has not arrowed yet (no dedicated results page in the mock phase).
      const item = results[activeIndex >= 0 ? activeIndex : 0];
      if (item) {
        event.preventDefault();
        window.location.assign(item.href);
      }
    }
  }

  const showPanel = isOpen;
  const hasQuery = query.length > 0;

  return (
    <div ref={rootRef} className="relative w-full max-w-2xl">
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        Search products
      </label>
      <input
        ref={inputRef}
        id={`${listboxId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showPanel && state === "results"}
        aria-controls={showPanel && state === "results" ? `${listboxId}-listbox` : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="Search products…"
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
        type="button"
        aria-label="Search"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className="absolute right-1 top-1/2 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors max-md:text-[var(--text-secondary)] max-md:hover:text-[var(--text-primary)] md:bg-[var(--color-action-red)] md:text-white md:hover:bg-[var(--color-action-red-dark)]"
      >
        {/* Mobile shows a filter-style affordance (approved UI reference);
            both focus the same search input. */}
        <SearchIcon size={18} className="max-md:hidden" />
        <SlidersIcon size={19} className="md:hidden" />
      </button>
      {showPanel ? (
        <div className="mega-panel-in absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--color-light-grey)] bg-white shadow-xl">
          {state === "idle" ? (
            <nav aria-label="Popular categories" className="py-2">
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Popular categories
              </p>
              <ul>
                {POPULAR_CATEGORIES.map((category) => (
                  <li key={category.href + category.name}>
                    <Link
                      href={category.href}
                      className="flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-card)]"
                      onClick={() => setIsOpen(false)}
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
            <p role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-muted)]">
              <SearchIcon size={16} className="animate-pulse" />
              Searching…
            </p>
          ) : null}
          {state === "error" ? (
            <p role="alert" className="px-4 py-3 text-sm text-[var(--color-action-red)]">
              Search is unavailable right now. Please try again.
            </p>
          ) : null}
          {state === "empty" ? (
            <p role="status" className="px-4 py-3 text-sm text-[var(--text-muted)]">
              No matches for “{query.trim()}”. Try a category name like “Lighting”.
            </p>
          ) : null}
          {state === "results" ? (
            <>
              <ul id={`${listboxId}-listbox`} role="listbox" aria-label="Search suggestions" className="py-1">
                {results.map((item, index) => (
                  <li
                    key={item.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    {/* The <mark> highlight splits the title into separate text
                        nodes, so spell the accessible name out explicitly. */}
                    <Link
                      href={item.href}
                      aria-label={`${item.title} (${item.section})`}
                      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-card)] ${
                        index === activeIndex ? "bg-[var(--surface-card)]" : ""
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <SearchIcon size={16} className="shrink-0 text-[var(--text-muted)]" />
                      <span className="min-w-0 flex-1 truncate">
                        <HighlightedTitle title={item.title} query={query} />
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                        {item.section}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="border-t border-[var(--color-light-grey)] px-4 py-1.5 text-xs text-[var(--text-muted)]">
                Sample data — live catalog search is connected in a later phase.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
