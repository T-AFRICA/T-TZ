"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ProductTab {
  id: string;
  label: string;
  /** Server-rendered panel content (the product grid). */
  content: ReactNode;
}

interface ProductTabsProps {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly ProductTab[];
  className?: string;
}

/**
 * Tabbed product rails for the phone homepage (owner request 2026-11-10).
 * Panels are rendered on the server and passed in, so this component only
 * switches which one is visible. Follows the WAI-ARIA tabs pattern: one tab
 * in the tab order, Left/Right/Home/End move between tabs and activate them.
 */
export function ProductTabs({ label, tabs, className }: ProductTabsProps) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    setActiveId(tab.id);
    const button = tabRefs.current[index];
    button?.focus();
    // Optional call: jsdom (tests) has no scrollIntoView.
    button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index === last ? 0 : index + 1)
        : event.key === "ArrowLeft"
          ? (index === 0 ? last : index - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    focusTab(next);
  }

  return (
    <section className={className} aria-label={label}>
      <div
        role="tablist"
        aria-label={label}
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-red)] ${
                selected
                  ? "bg-[var(--color-action-red)] text-white shadow-sm"
                  : "bg-white text-[var(--text-secondary)] shadow-[0_1px_4px_rgba(17,17,17,0.08)] hover:text-[var(--color-action-red)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="mt-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-action-red)]"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
