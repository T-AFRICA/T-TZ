"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { STOCK_ADJUST_MODES, STOCK_NOTE_MAX, STOCK_REASONS_FOR, type StockAdjustMode } from "@tronic/api-contracts";
import { useToast } from "@tronic/ui";
import { IDLE, type FormState } from "@/features/form-state";
import { STOCK_MODE_LABEL, STOCK_REASON_LABEL } from "@/features/inventory/labels";
import { FormMessage, SelectField, SubmitButton, TextField } from "./forms";

/**
 * The stock forms of the console: a change with its reason, and a product's
 * low-stock level. Each posts to a server action; the country decides.
 */

type Action = (previous: FormState, form: FormData) => Promise<FormState>;

function useResultToast(state: FormState) {
  const { showToast } = useToast();
  const last = useRef<FormState | null>(null);
  useEffect(() => {
    if (last.current === state) return;
    last.current = state;
    if (state.status === "ok" && state.message) showToast(state.message, "success");
  }, [state, showToast]);
}

export function AdjustStockForm({ action, countryId, slug, available }: { action: Action; countryId: string; slug: string; available: number }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [mode, setMode] = useState<StockAdjustMode>("add");
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);
  const errors = state.fieldErrors ?? {};
  const reasons = STOCK_REASONS_FOR[mode];

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">What happened</legend>
        <div className="flex flex-wrap gap-2">
          {STOCK_ADJUST_MODES.map((value) => (
            <label
              key={value}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="accent-[var(--a-accent)]" />
              {STOCK_MODE_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          key={`quantity-${mode}`}
          name="quantity"
          label={mode === "set" ? "Units counted" : "Units"}
          inputMode="numeric"
          required
          error={errors.quantity}
          hint={mode === "set" ? `Now ${available}. The difference is recorded.` : `Now ${available}.`}
        />
        <SelectField key={`reason-${mode}`} name="reason" label="Reason" required defaultValue={reasons[0]} error={errors.reason}>
          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {STOCK_REASON_LABEL[reason]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField name="note" label="Note (optional; needed for Other)" maxLength={STOCK_NOTE_MAX} error={errors.note} hint="e.g. Supplier delivery note 1452" />
      {state.status === "error" && state.message ? <FormMessage state={state} /> : null}
      <div>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save stock change
        </SubmitButton>
      </div>
    </form>
  );
}

export function LowStockForm({ action, countryId, slug, level }: { action: Action; countryId: string; slug: string; level: number }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  useResultToast(state);
  return (
    <form action={formAction} noValidate className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="w-44">
        <TextField name="level" label="Low at (units)" inputMode="numeric" defaultValue={level} error={state.fieldErrors?.level} />
      </div>
      <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
        Set level
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
