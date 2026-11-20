"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { TAXONOMY_LIMITS, type TaxonomyLevel } from "@tronic/api-contracts";
import { useToast } from "@tronic/ui";
import { IDLE, type FormState } from "@/features/form-state";
import { FormMessage, SelectField, SubmitButton, TextField } from "./forms";
import { shrinkPhoto } from "./products";
import { buttonClass } from "./ui";

/**
 * The category and brand forms of the console. Each posts to a server
 * action; the country decides. A web address is set once, when something is
 * added, and never changes.
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

export interface TaxonomyFormProps {
  action: Action;
  countryId: string;
  level: TaxonomyLevel;
  /** The node being edited; absent when adding one. */
  node?: { id: string; slug: string; name: string; description?: string | null; sortOrder: number; active: boolean; live: number };
  /** For a new group its category, for a new subcategory its group. */
  parentId?: string;
  submitLabel: string;
  /** A compact single-row layout for lists. */
  compact?: boolean;
}

export function TaxonomyForm({ action, countryId, level, node, parentId, submitLabel, compact = false }: TaxonomyFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [shown, setShown] = useState(node ? node.active : true);
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => {
    if (state.status === "ok" && !node) formRef.current?.reset();
  }, [state, node]);
  const errors = state.fieldErrors ?? {};
  const hiding = node && node.active && !shown && node.live > 0;

  return (
    <form ref={formRef} action={formAction} noValidate className={compact ? "flex flex-wrap items-end gap-3" : "flex flex-col gap-4"}>
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="level" value={level} />
      {node ? <input type="hidden" name="id" value={node.id} /> : null}
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <div className={compact ? "min-w-48 flex-1" : ""}>
        <TextField name="name" label="Name" required maxLength={TAXONOMY_LIMITS.name} defaultValue={node?.name ?? ""} error={errors.name} />
      </div>
      {node ? null : (
        <div className={compact ? "min-w-44 flex-1" : ""}>
          <TextField
            name="slug"
            label="Web address (optional)"
            maxLength={TAXONOMY_LIMITS.slug}
            error={errors.slug}
            hint={compact ? undefined : "Made from the name when empty. It cannot change later."}
            spellCheck={false}
          />
        </div>
      )}
      {level === "category" ? (
        <div className={compact ? "min-w-64 flex-[2]" : ""}>
          <TextField
            name="description"
            label="Line under the name (optional)"
            maxLength={TAXONOMY_LIMITS.description}
            defaultValue={node?.description ?? ""}
            error={errors.description}
          />
        </div>
      ) : null}
      <div className="w-28">
        <TextField name="sortOrder" label="Order" inputMode="numeric" defaultValue={node?.sortOrder ?? 0} error={errors.sortOrder} />
      </div>
      <div className="w-40">
        <SelectField name="shown" label="On the website" value={shown ? "true" : "false"} onChange={(event) => setShown(event.currentTarget.value === "true")}>
          <option value="true">Shown</option>
          <option value="false">Hidden</option>
        </SelectField>
      </div>
      {hiding ? (
        <p role="status" className="w-full rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {level === "category"
            ? `${node.live} live ${node.live === 1 ? "product" : "products"} in this category will disappear from the website until it is shown again.`
            : `It disappears from the menu; its ${node.live} live ${node.live === 1 ? "product stays" : "products stay"} on the category's page.`}
        </p>
      ) : null}
      {state.status === "error" && state.message ? (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      ) : null}
      <div>
        <SubmitButton pending={pending} variant={node ? "secondary" : "primary"} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

export function BrandForm({ action, countryId, brand }: { action: Action; countryId: string; brand?: { id: string; name: string } }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => {
    if (state.status === "ok" && !brand) formRef.current?.reset();
  }, [state, brand]);
  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="countryId" value={countryId} />
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
      <div className="min-w-48 flex-1">
        <TextField
          name="name"
          label={brand ? `Name of ${brand.name}` : "New brand"}
          maxLength={TAXONOMY_LIMITS.brandName}
          defaultValue={brand?.name ?? ""}
          error={state.fieldErrors?.name}
        />
      </div>
      <SubmitButton pending={pending} variant={brand ? "secondary" : "primary"} pendingLabel="Saving…">
        {brand ? "Rename" : "Add brand"}
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

export function BannerUpload({ action, countryId, categoryId, hasBanner }: { action: Action; countryId: string; categoryId: string; hasBanner: boolean }) {
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
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="countryId" value={countryId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="image" value={photo} />
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {hasBanner ? "Replace the banner photo" : "Add a banner photo"}
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
            A wide photo works best (about 2:1). It is made smaller here before it is sent.
          </p>
        )}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo about to be sent
          <img src={photo} alt="The banner that will be saved" className="h-32 w-auto max-w-full rounded-lg border border-line bg-raised object-contain" />
        ) : null}
        {state.status === "error" && state.message ? <FormMessage state={state} /> : null}
        <div>
          <button type="submit" className={buttonClass.secondary} disabled={pending || reading || !photo}>
            {pending ? "Saving…" : reading ? "Preparing…" : "Save banner"}
          </button>
        </div>
      </form>
    </div>
  );
}
