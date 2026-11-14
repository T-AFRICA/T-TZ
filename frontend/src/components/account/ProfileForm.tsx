"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileFormState } from "@/features/account/actions";

const IDLE: ProfileFormState = { status: "idle" };
const FIELD =
  "h-12 w-full rounded-xl border bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--color-action-red)]";

/**
 * Name and phone of the signed-in customer. A normal POST form bound to a
 * server action, so it also works before JavaScript loads; the email is
 * shown but not editable here (changing it needs a confirmation flow).
 */
export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, IDLE);
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Full name</span>
          <input
            name="fullName"
            type="text"
            defaultValue={fullName}
            autoComplete="name"
            maxLength={80}
            required
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? "profile-name-error" : undefined}
            className={`${FIELD} ${errors.fullName ? "border-[#b3141a]" : "border-[var(--color-light-grey)]"}`}
          />
          {errors.fullName ? (
            <span id="profile-name-error" className="mt-1 block text-xs font-medium text-[#b3141a]">
              {errors.fullName}
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Mobile number</span>
          <input
            name="phone"
            type="tel"
            defaultValue={phone}
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            placeholder="0712 345 678"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "profile-phone-error" : undefined}
            className={`${FIELD} ${errors.phone ? "border-[#b3141a]" : "border-[var(--color-light-grey)]"}`}
          />
          {errors.phone ? (
            <span id="profile-phone-error" className="mt-1 block text-xs font-medium text-[#b3141a]">
              {errors.phone}
            </span>
          ) : null}
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold">Email address</span>
          <input
            type="email"
            value={email}
            readOnly
            aria-describedby="profile-email-note"
            className={`${FIELD} cursor-not-allowed border-[var(--color-light-grey)] bg-[#f6f6f7] text-[var(--text-secondary)]`}
          />
          <span id="profile-email-note" className="mt-1 block text-xs text-[var(--text-secondary)]">
            Your email is your sign-in. Changing it is not available here yet.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)] disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {state.status === "saved" ? <span className="font-medium text-[#17743a]">Profile saved.</span> : null}
          {state.status === "error" ? <span className="font-medium text-[#b3141a]">{state.message}</span> : null}
          {state.status === "invalid" ? <span className="font-medium text-[#b3141a]">Check the highlighted fields.</span> : null}
        </p>
      </div>
    </form>
  );
}
