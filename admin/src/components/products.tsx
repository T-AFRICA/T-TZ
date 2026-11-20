"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { PRODUCT_LIMITS } from "@tronic/api-contracts";
import { useToast } from "@tronic/ui";
import { IDLE, type FormState } from "@/features/form-state";
import type { ProductFormState } from "@/features/products/actions";
import type { ProductFormValues } from "@/features/products/form";
import { FormMessage, SelectField, SubmitButton, TextField } from "./forms";
import { buttonClass, inputClass } from "./ui";

/**
 * The product pieces of the console that run in the browser: the product
 * form (it shows what was typed again after a refusal), the photo upload
 * (the photo is made smaller in the browser first), the photo order buttons
 * and the stock form. Every one posts to a server action; the country
 * decides.
 */

type SaveAction = (previous: ProductFormState, form: FormData) => Promise<ProductFormState>;
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

function TextArea({
  name,
  label,
  hint,
  error,
  rows = 4,
  ...rest
}: { name: string; label: string; hint?: string; error?: string | undefined; rows?: number } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "className" | "rows">) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea id={id} name={name} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...rest} />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface ProductFormProps {
  action: SaveAction;
  countryId: string;
  currency: string;
  currencyExponent: number;
  /** The product's web address when editing; absent for a new product. */
  slug?: string;
  initial: ProductFormValues;
  placements: { value: string; label: string; active: boolean }[];
  brands: { id: string; name: string }[];
  submitLabel: string;
}

export function ProductForm({ action, countryId, currency, currencyExponent, slug, initial, placements, brands, submitLabel }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, IDLE);
  useResultToast(state);
  // After each answer the fields start again from what was sent (React clears a form after its action):
  // a new answer gives the fields a new key, so they take their values from it.
  const values = state.values ?? initial;
  const round = state === IDLE ? "initial" : JSON.stringify(state);
  const errors = state.fieldErrors ?? {};
  const creating = slug === undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="currencyExponent" value={currencyExponent} />
      {slug ? <input type="hidden" name="slug" value={slug} /> : null}
      <div key={round} className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="name" label="Name" required maxLength={PRODUCT_LIMITS.name} defaultValue={values.name} error={errors.name} />
          <TextField
            name="sku"
            label="SKU"
            required
            maxLength={40}
            defaultValue={values.sku}
            error={errors.sku}
            hint="Capital letters, digits and dashes, e.g. TZ-BULB-12W"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {creating ? (
            <TextField
              name="slug"
              label="Web address (optional)"
              maxLength={80}
              defaultValue={values.slug}
              error={errors.slug}
              hint="Made from the name when empty. It cannot change later: carts and links use it."
              spellCheck={false}
            />
          ) : null}
          <SelectField name="placement" label="Where it belongs" required defaultValue={values.placement} error={errors.placement}>
            <option value="">Choose a category…</option>
            {placements.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
                {choice.active ? "" : " (hidden)"}
              </option>
            ))}
          </SelectField>
          <SelectField name="brandId" label="Brand" defaultValue={values.brandId} error={errors.brandId}>
            <option value="">No brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </SelectField>
        </div>

        <TextArea name="description" label="Description" rows={5} maxLength={PRODUCT_LIMITS.description} defaultValue={values.description} error={errors.description} />

        <fieldset className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-ink">Price in {currency}</legend>
          <TextField name="price" label={`Price (${currency})`} required inputMode="decimal" defaultValue={values.price} error={errors.price} hint="e.g. 28000" />
          <TextField
            name="wasPrice"
            label={`Earlier price (${currency}, optional)`}
            inputMode="decimal"
            defaultValue={values.wasPrice}
            error={errors.wasPrice}
            hint="Shown struck through for an offer. Leave empty for none."
          />
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-ink">Options and details</legend>
          <TextField name="variantLabel" label="Option name (optional)" maxLength={PRODUCT_LIMITS.variantLabel} defaultValue={values.variantLabel} error={errors.variantLabel} hint="e.g. Wattage or Size" />
          <TextArea name="variants" label="Options" rows={3} defaultValue={values.variants} error={errors.variants} hint="One per line or comma separated, e.g. 9W, 12W" />
          <TextArea
            name="colors"
            label="Colours"
            rows={3}
            defaultValue={values.colors}
            error={errors.colors}
            hint='One per line: name and colour code, e.g. "Warm white #FFE9B0"'
          />
          <TextArea
            name="specifications"
            label="Specifications"
            rows={5}
            defaultValue={values.specifications}
            error={errors.specifications}
            hint='One per line: "Label: value", e.g. "Power: 12 W"'
          />
        </fieldset>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Makes a photo small enough to send: at most 1600 px on the long side, WebP where the browser can, else JPEG, under 1 MB. */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    let url = canvas.toDataURL("image/webp", quality);
    // A browser that cannot write WebP answers with PNG.
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < 1_350_000) return url; // under 1 MB once decoded
  }
  throw new Error("too large");
}

export function PhotoUpload({ action, countryId, slug }: { action: Action; countryId: string; slug: string }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [photo, setPhoto] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => {
    if (state.status === "ok") {
      setPhoto("");
      formRef.current?.reset();
    }
  }, [state]);
  const error = problem ?? state.fieldErrors?.image;

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="image" value={photo} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Add a photo
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-ink file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            setProblem(null);
            setPhoto("");
            if (!file) return;
            setReading(true);
            try {
              setPhoto(await shrinkPhoto(file));
            } catch {
              setProblem("That file could not be read as a photo, or stays over 1 MB. Try a JPEG, PNG or WebP photo.");
            } finally {
              setReading(false);
            }
          }}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : (
          <p id={`${inputId}-hint`} className="text-xs text-muted">
            JPEG, PNG or WebP. It is made smaller here before it is sent (at most 1600 px, under 1 MB).
          </p>
        )}
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo about to be sent
        <img src={photo} alt="The photo that will be added" className="h-32 w-32 rounded-lg border border-line bg-raised object-contain" />
      ) : null}
      <TextField name="alt" label="What the photo shows (optional)" maxLength={PRODUCT_LIMITS.alt} error={state.fieldErrors?.alt} hint="Read out to people who cannot see it." />
      {state.status === "error" && state.message ? <FormMessage state={state} /> : null}
      <div>
        <button type="submit" className={buttonClass.secondary} disabled={pending || reading || !photo}>
          {pending ? "Adding…" : reading ? "Preparing…" : "Add photo"}
        </button>
      </div>
    </form>
  );
}

/** One button that sets the product's photos to `keep`, in that order (move, make main). */
export function PhotoOrderButton({ action, countryId, slug, keep, label, title }: { action: Action; countryId: string; slug: string; keep: string[]; label: string; title: string }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  useResultToast(state);
  return (
    <form action={formAction}>
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="keep" value={keep.join(",")} />
      <button type="submit" className={buttonClass.quiet} disabled={pending} aria-label={title} title={title}>
        {pending ? "…" : label}
      </button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function StockForm({ action, countryId, slug, available }: { action: Action; countryId: string; slug: string; available: number | null }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  useResultToast(state);
  return (
    <form action={formAction} noValidate className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="w-40">
        <TextField name="available" label="Units in stock" inputMode="numeric" defaultValue={available ?? 0} error={state.fieldErrors?.available} />
      </div>
      <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
        Set stock
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
