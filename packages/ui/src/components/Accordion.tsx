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
 * top border for an accordion group. The open animation relies on the
 * app-level `accordion-in` keyframes (defined with the other global
 * motion rules); without them the row simply opens instantly.
 */
export function AccordionSection({ title, defaultOpen = false, children }: AccordionSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-[var(--color-light-grey)] last:border-b-0"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 py-4 text-sm font-semibold transition-colors hover:text-[var(--color-action-red)] [&::-webkit-details-marker]:hidden">
        {title}
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--text-muted)] transition-transform group-open:rotate-180">
          <ChevronDownIcon size={13} />
        </span>
      </summary>
      <div className="pb-4 text-sm leading-relaxed text-[var(--text-secondary)] group-open:animate-[accordion-in_240ms_ease-out]">
        {children}
      </div>
    </details>
  );
}
