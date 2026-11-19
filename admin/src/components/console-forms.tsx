"use client";

import { useActionState, useState } from "react";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "@tronic/ui";
import type { AdminCountry, CountryService } from "@tronic/database/admin";
import { checkCountryServiceAction, inviteAdminAction, updateCountryAction, updateCountryServiceAction } from "@/features/admin/actions";
import {
  signInAction,
  startMfaEnrollmentAction,
  verifyMfaChallengeAction,
  verifyMfaEnrollmentAction,
  type MfaSetupState,
} from "@/features/auth/actions";
import { IDLE } from "@/features/form-state";
import { addOrderNoteAction } from "@/features/orders/actions";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "./forms";
import { buttonClass, inputClass } from "./ui";

// --------------------------------------------------------------- sign-in --

/** A sign-in field with an icon inside, in the TRONIC sign-in style (globals.css, .auth-*). */
function AuthField({
  id,
  label,
  icon,
  error,
  reveal,
  ...input
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string | undefined;
  reveal?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "className">) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        {icon}
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...input} />
        {reveal}
      </div>
      {error ? (
        <p id={`${id}-error`} className="auth-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasswordField({ disabled, error }: { disabled: boolean; error?: string | undefined }) {
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      id="sign-in-password"
      name="password"
      label="Password"
      icon={<LockIcon size={18} />}
      type={shown ? "text" : "password"}
      autoComplete="current-password"
      placeholder="Your password"
      required
      disabled={disabled}
      error={error}
      reveal={
        <button type="button" className="auth-reveal" onClick={() => setShown((value) => !value)} aria-pressed={shown} aria-label={shown ? "Hide what you typed" : "Show what you typed"} disabled={disabled}>
          {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      }
    />
  );
}

export function SignInForm({ disabled }: { disabled: boolean }) {
  return (
    <ActionForm action={signInAction} className="auth-form flex flex-col gap-4">
      {(state, pending) => (
        <>
          <AuthField
            id="sign-in-email"
            name="email"
            label="Email address"
            icon={<MailIcon size={18} />}
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Your work email"
            required
            disabled={disabled}
            error={state.fieldErrors?.email}
          />
          <PasswordField disabled={disabled} error={state.fieldErrors?.password} />
          <FormMessage state={state} />
          <button type="submit" className="auth-submit" disabled={pending || disabled}>
            {pending ? (
              <>
                <span className="auth-spinner" aria-hidden="true" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRightIcon size={18} />
              </>
            )}
          </button>
        </>
      )}
    </ActionForm>
  );
}

function CodeField({ error }: { error?: string | undefined }) {
  return (
    <TextField
      name="code"
      label="6-digit code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      required
      autoFocus
      error={error}
      hint="From your authenticator app. It changes every 30 seconds."
    />
  );
}

export function MfaChallengeForm() {
  return (
    <ActionForm action={verifyMfaChallengeAction}>
      {(state, pending) => (
        <>
          <CodeField error={state.fieldErrors?.code} />
          <FormMessage state={state} />
          <button type="submit" className={`${buttonClass.primary} w-full`} disabled={pending}>
            {pending ? "Checking…" : "Verify"}
          </button>
        </>
      )}
    </ActionForm>
  );
}

/** Two steps on one page: start the set-up (shows the QR code), then confirm it with a code. */
export function MfaSetupForm() {
  const [setup, startAction, starting] = useActionState<MfaSetupState, FormData>(startMfaEnrollmentAction, IDLE);

  if (!setup.enrollment) {
    return (
      <form action={startAction} className="flex flex-col gap-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Install an authenticator app on your phone if you don&apos;t have one.</li>
          <li>Choose &quot;Set up authenticator&quot; and scan the code that appears.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <FormMessage state={setup} />
        <button type="submit" className={`${buttonClass.primary} w-full`} disabled={starting}>
          {starting ? "Preparing…" : "Set up authenticator"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI from the account service, shown once */}
        <img src={setup.enrollment.qrCode} alt="QR code to scan with your authenticator app" width={180} height={180} />
      </div>
      <p className="text-sm text-muted">
        Can&apos;t scan it? Enter this key in the app instead:{" "}
        <code className="break-all rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-ink">{setup.enrollment.secret}</code>
      </p>
      <ActionForm action={verifyMfaEnrollmentAction}>
        {(state, pending) => (
          <>
            <input type="hidden" name="factorId" value={setup.enrollment?.factorId ?? ""} />
            <CodeField error={state.fieldErrors?.code} />
            <FormMessage state={state} />
            <button type="submit" className={`${buttonClass.primary} w-full`} disabled={pending}>
              {pending ? "Checking…" : "Confirm and continue"}
            </button>
          </>
        )}
      </ActionForm>
    </div>
  );
}

// ---------------------------------------------------------------- console --

export function InviteForm({
  countries,
  roles,
  fixedCountryId,
}: {
  countries: { id: string; name: string }[];
  roles: { key: string; name: string }[];
  /** On a country's staff page the country is not a choice. */
  fixedCountryId?: string;
}) {
  return (
    <ActionForm action={inviteAdminAction} resetOnSuccess className="grid items-start gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]">
      {(state, pending) => (
        <>
          <TextField name="email" label="Email address" type="email" autoComplete="off" inputMode="email" required error={state.fieldErrors?.email} />
          <SelectField name="role" label="Role" required defaultValue="" error={state.fieldErrors?.role}>
            <option value="" disabled>
              Choose a role
            </option>
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </SelectField>
          {fixedCountryId ? (
            <input type="hidden" name="countryId" value={fixedCountryId} />
          ) : (
            <SelectField name="countryId" label="Country" required defaultValue="" error={state.fieldErrors?.countryId}>
              <option value="" disabled>
                Choose a country
              </option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </SelectField>
          )}
          <div className="md:pt-[1.625rem]">
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Give role
            </SubmitButton>
          </div>
          <div className="md:col-span-full">
            <FormMessage state={state} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["planned", "Planned"],
  ["pending_confirmation", "Awaiting confirmation"],
  ["suspended", "Suspended"],
] as const;

export function CountryForm({ country, timeZones }: { country: AdminCountry; timeZones: readonly string[] }) {
  return (
    <ActionForm action={updateCountryAction}>
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={country.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="name" label="Country name" defaultValue={country.name} required maxLength={60} error={state.fieldErrors?.name} />
            <SelectField name="status" label="Operational status" defaultValue={country.status} error={state.fieldErrors?.status}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextField name="isoCode" label="ISO country code" defaultValue={country.isoCode ?? ""} maxLength={2} placeholder="Not set" hint="Two letters, for example TZ." error={state.fieldErrors?.isoCode} />
            <TextField name="currency" label="Currency" defaultValue={country.currency ?? ""} maxLength={3} placeholder="Not set" hint="ISO 4217 code, for example TZS." error={state.fieldErrors?.currency} />
            <SelectField name="timezone" label="Time zone" defaultValue={country.timezone ?? ""} error={state.fieldErrors?.timezone}>
              <option value="">Not set</option>
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </SelectField>
            <TextField name="websiteDomain" label="Website domain" defaultValue={country.websiteDomain ?? ""} placeholder="Not set" hint="Domain only, without https://." error={state.fieldErrors?.websiteDomain} />
          </div>
          <FormMessage state={state} />
          <div>
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Save configuration
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function CountryServiceForm({ service }: { service: CountryService }) {
  return (
    <ActionForm action={updateCountryServiceAction}>
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={service.countryId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                name="apiBaseUrl"
                label="Country API address"
                defaultValue={service.apiBaseUrl ?? ""}
                placeholder="Not registered"
                hint="HTTPS only, for example https://tronic.co.tz. No keys or passwords belong here."
                error={state.fieldErrors?.apiBaseUrl}
              />
            </div>
            <TextField name="vercelProject" label="Vercel project" defaultValue={service.vercelProject ?? ""} placeholder="Not set" error={state.fieldErrors?.vercelProject} />
            <TextField
              name="supabaseProjectRef"
              label="Supabase project reference"
              defaultValue={service.supabaseProjectRef ?? ""}
              placeholder="Not set"
              hint="The project's reference id, not a key."
              error={state.fieldErrors?.supabaseProjectRef}
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="enabled" defaultChecked={service.enabled} className="mt-0.5 h-4 w-4 accent-[var(--a-accent)]" />
            <span>
              <span className="font-medium">Allow the Central Admin to call this service</span>
              <span className="block text-xs text-muted">Off: nothing is ever sent to the address above.</span>
            </span>
          </label>
          <FormMessage state={state} />
          <div>
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Save registration
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function CheckServiceForm({ countryId }: { countryId: string }) {
  return (
    <ActionForm action={checkCountryServiceAction} className="flex flex-col gap-3">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <div>
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Checking…">
              Check connection
            </SubmitButton>
          </div>
          <FormMessage state={state} />
        </>
      )}
    </ActionForm>
  );
}

// ----------------------------------------------------------------- orders --

export function OrderNoteForm({ countryId, orderNumber }: { countryId: string; orderNumber: string }) {
  return (
    <ActionForm action={addOrderNoteAction} resetOnSuccess className="flex flex-col gap-3">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="order-note" className="text-sm font-medium text-ink">
              Add an internal note
            </label>
            <textarea
              id="order-note"
              name="body"
              rows={3}
              maxLength={1000}
              required
              aria-invalid={state.fieldErrors?.body ? true : undefined}
              aria-describedby="order-note-hint"
              className={inputClass}
            />
            <p id="order-note-hint" className={state.fieldErrors?.body ? "text-xs font-medium text-danger" : "text-xs text-muted"}>
              {state.fieldErrors?.body ?? "Seen by administrators only. The customer never sees it."}
            </p>
          </div>
          <FormMessage state={state} />
          <div>
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
              Add note
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
