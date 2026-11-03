"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  /** id of the initially selected tab; defaults to the first. */
  defaultTab?: string;
}

/**
 * Accessible tabs (§10): WAI-ARIA tablist with roving tabindex — Left/Right
 * arrows, Home and End move the selection; the red underline marks the
 * active tab without being the only indicator (bold weight pairs with it).
 */
export function Tabs({ tabs, defaultTab }: TabsProps) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const wrapped = (index + tabs.length) % tabs.length;
    const target = tabs[wrapped];
    if (target) {
      setActiveId(target.id);
      tabRefs.current[wrapped]?.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-[var(--color-light-grey)]">
        {tabs.map((tab, index) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-[var(--color-action-red)] font-semibold text-[var(--text-primary)]"
                  : "border-transparent font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className="py-4"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
