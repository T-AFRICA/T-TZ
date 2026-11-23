"use client";

import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/forms";
import { setExchangeRateAction } from "@/features/global-reports/actions";

/**
 * One country's US dollar rate, typed by the Master Super Admin. The
 * server action and the database decide whether it is saved; this form
 * only collects the number.
 */
export function ExchangeRateForm({ countryId, countryName, currency, current }: { countryId: string; countryName: string; currency: string; current: string | null }) {
  return (
    <ActionForm action={setExchangeRateAction} className="flex flex-col gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                name="rate"
                label={`${currency} for 1 US dollar`}
                inputMode="decimal"
                autoComplete="off"
                maxLength={20}
                required
                defaultValue={current ?? ""}
                placeholder="For example 2650"
                error={state.fieldErrors?.rate}
                aria-label={`${countryName}: ${currency} for 1 US dollar`}
              />
            </div>
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
          <FormMessage state={state} />
        </>
      )}
    </ActionForm>
  );
}
