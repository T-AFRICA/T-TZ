import type { ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

export interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Disclosure row (§10) on the native <details> element — no JS, keyboard
 * and assistive-tech behavior for free. Consumers stack several under a
 * top border for an accordion group. Height and fade animation rely on the
 * app-level `accordion-row` rules and `accordion-in` keyframes (defined with
 * the other global motion rules); without them the row simply opens instantly.
 */
export function AccordionSection({ title, defaultOpen = false, children }: AccordionSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="accordion-row group border-b border-[var(--color-light-grey)] last:border-b-0"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold transition-colors hover:text-[var(--color-action-red)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-red)] [&::-webkit-details-marker]:hidden">
        {title}
        <span className="shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-180">
          <ChevronDownIcon size={15} />
        </span>
      </summary>
      <div className="pb-4 text-[13px] leading-relaxed text-[var(--text-secondary)] group-open:animate-[accordion-in_240ms_ease-out] md:text-sm">
        {children}
      </div>
    </details>
  );
}
