"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * The number between the − and + buttons of a quantity stepper, which the
 * customer can also type: with up to 500 units in a line, stepping one at a
 * time is not enough.
 *
 * Only digits are kept while typing, one more than the limit has, so a
 * number over the limit becomes the limit instead of losing its last
 * digit. The value is applied when the field is
 * left or Enter is pressed, held between 1 and `max`; an empty field goes
 * back to the quantity it had. This is a convenience only: the server
 * checks the quantity again when the order is priced and placed.
 */
export function QuantityField({
  value,
  max,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  value: number;
  max: number;
  onChange: (quantity: number) => void;
  /** Read out for the field, e.g. "Quantity". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  /** What is being typed; null while the field shows the current quantity. */
  const [draft, setDraft] = useState<string | null>(null);

  function apply() {
    if (draft === null) return;
    const typed = Number.parseInt(draft, 10);
    setDraft(null);
    if (!Number.isInteger(typed)) return;
    const next = Math.min(Math.max(typed, 1), max);
    if (next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
      event.currentTarget.blur();
    } else if (event.key === "Escape" && draft !== null) {
      event.stopPropagation();
      setDraft(null);
    }
  }

  return (
    <>
      {/* Read out when − or + changes the quantity, as the plain number was before it could be typed. */}
      <span aria-live="polite" className="sr-only">
        {value}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        disabled={disabled}
        maxLength={String(max).length + 1}
        value={draft ?? String(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={apply}
        onKeyDown={onKeyDown}
        className={`rounded-md bg-transparent text-center font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-red)] disabled:text-[var(--text-muted)] ${className}`}
      />
    </>
  );
}
