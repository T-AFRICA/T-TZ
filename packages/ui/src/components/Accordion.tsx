"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon } from "./icons";

export interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  /** Heading level of the title; the page's h1 is the product, so rows default to h2. */
  headingLevel?: "h2" | "h3" | "h4";
  children: ReactNode;
}

const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Disclosure row (§10): a heading with a button that toggles a region, the
 * WAI-ARIA accordion pattern. Open rows ship their content in the server
 * HTML, so a default-open overview is readable before hydration. The reveal
 * is a short Motion height-and-fade in every browser; under reduced motion
 * the content simply appears.
 */
export function AccordionSection({
  title,
  defaultOpen = false,
  headingLevel: Heading = "h2",
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE };

  return (
    <div className="border-b border-[var(--color-light-grey)] last:border-b-0">
      <Heading className="m-0 text-[15px] font-semibold leading-tight">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          // The region exists only while open, so the reference is only set then.
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-[3.25rem] w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-[var(--text-primary)] transition-colors hover:text-[var(--color-action-red)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-red)]"
        >
          {title}
          {/* The chevron sits in a small disc that fills when the row is open,
              so the state reads at a glance without heavy cards. */}
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={transition}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
              open
                ? "bg-[var(--color-premium-black)] text-white"
                : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
            }`}
          >
            <ChevronDownIcon size={14} />
          </motion.span>
        </button>
      </Heading>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="overflow-hidden"
          >
            <div className="pb-4 pr-1 text-[13px] leading-relaxed text-[var(--text-secondary)] md:text-sm">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
