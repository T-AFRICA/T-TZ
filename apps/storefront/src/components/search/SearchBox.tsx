"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SearchResultItem, SearchState } from "@tronic/types";
import { SearchIcon, SlidersIcon } from "@tronic/ui";
import { createSearchClient, type SearchClient } from "@tronic/api-client";

const DEBOUNCE_MS = 300;

export interface SearchBoxProps {
  /** Injectable for tests; defaults to the mock adapter (live lands W09+). */
  client?: SearchClient;
}

/**
 * Header search shell (SRS FR-006): an accessible combobox with debounced
 * querying and explicit idle / loading / results / empty / error states.
 * Results come from the mock adapter and are labelled as sample data.
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
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const item = results[activeIndex];
      if (item) {
        event.preventDefault();
        window.location.assign(item.href);
      }
    }
  }

  const showPanel = isOpen && state !== "idle";

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
        aria-expanded={showPanel}
        aria-controls={`${listboxId}-listbox`}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder="What are you looking for?"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border border-[var(--color-light-grey)] bg-white pl-5 pr-14 text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--color-mid-grey)] max-md:rounded-xl max-md:border-transparent max-md:pl-11 max-md:shadow-sm"
      />
      {/* Leading icon on the mobile pill (approved mobile UI reference) */}
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] md:hidden"
      />
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
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--color-light-grey)] bg-white shadow-lg">
          {state === "loading" ? (
            <p role="status" className="px-3 py-3 text-sm text-[var(--text-muted)]">
              Searching…
            </p>
          ) : null}
          {state === "error" ? (
            <p role="alert" className="px-3 py-3 text-sm text-[var(--color-action-red)]">
              Search is unavailable right now. Please try again.
            </p>
          ) : null}
          {state === "empty" ? (
            <p role="status" className="px-3 py-3 text-sm text-[var(--text-muted)]">
              No matches for “{query.trim()}”. Try a category name like “Lighting”.
            </p>
          ) : null}
          {state === "results" ? (
            <>
              <ul id={`${listboxId}-listbox`} role="listbox" aria-label="Search suggestions">
                {results.map((item, index) => (
                  <li
                    key={item.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <Link
                      href={item.href}
                      className={`flex items-baseline justify-between gap-2 px-3 py-2 text-sm ${
                        index === activeIndex ? "bg-[var(--surface-card)]" : ""
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <span>{item.title}</span>
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">{item.section}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="border-t border-[var(--color-light-grey)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                Sample data — live catalog search is connected in a later phase.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
