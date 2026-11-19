"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { DELIVERY_FAILURE_REASONS, DELIVERY_NOTE_MAX } from "@tronic/api-contracts";
import type { Rider } from "@tronic/database/admin";
import { useToast } from "@tronic/ui";
import { IDLE, type FormState } from "@/features/form-state";
import {
  assignRiderAction,
  riderDeliverAction,
  riderFailAction,
  setRiderContactAction,
} from "@/features/deliveries/actions";
import { FAILURE_REASON_LABEL } from "@/features/deliveries/labels";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "./forms";
import { buttonClass, inputClass } from "./ui";

/**
 * Delivery forms: assigning a rider (order managers) and the rider's own
 * steps at the door. Proofs are prepared in the browser (the photo made
 * smaller, the signature drawn on a canvas) and sent as images; the
 * country checks the code, the proofs and the cash.
 */

export function AssignRiderForm({
  countryId,
  orderNumber,
  riders,
  currentRiderId,
}: {
  countryId: string;
  orderNumber: string;
  riders: Rider[];
  currentRiderId: string | null;
}) {
  if (riders.length === 0) {
    return (
      <p className="text-sm text-muted">
        There are no riders in this country yet. Give someone the Rider role under Staff first.
      </p>
    );
  }
  return (
    <ActionForm action={assignRiderAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <div className="sm:min-w-64">
            <SelectField
              name="riderId"
              label={currentRiderId ? "Give to another rider" : "Rider"}
              defaultValue=""
              error={state.fieldErrors?.riderId}
            >
              <option value="" disabled>
                Choose a rider
              </option>
              {riders.map((rider) => (
                <option
                  key={rider.userId}
                  value={rider.userId}
                  disabled={rider.userId === currentRiderId}
                >
                  {rider.name ? `${rider.name} (${rider.email})` : rider.email}
                </option>
              ))}
            </SelectField>
          </div>
          <SubmitButton pending={pending} pendingLabel="Assigning…">
            {currentRiderId ? "Reassign" : "Assign rider"}
          </SubmitButton>
          <div className="sm:basis-full">
            <FormMessage state={state} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** A rider's name and phone, given to the customer with the rider's orders while they are on the way. */
export function RiderContactForm({ countryId, riderId, name, phone }: { countryId: string; riderId: string; name: string | null; phone: string | null }) {
  return (
    <ActionForm action={setRiderContactAction} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <input type="hidden" name="riderId" value={riderId} />
          <TextField
            name="name"
            label="Rider's name"
            autoComplete="off"
            defaultValue={name ?? ""}
            maxLength={80}
            required
            hint="The customer sees the first name."
            error={state.fieldErrors?.name}
          />
          <TextField
            name="phone"
            label="Rider's phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={phone ?? ""}
            placeholder="0712 345 678"
            hint="The customer can call it while the order is on its way."
            error={state.fieldErrors?.phone}
          />
          <div className="sm:pt-[1.625rem]">
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </div>
          <div className="sm:col-span-full">
            <FormMessage state={state} />
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function FailedAttemptForm({
  countryId,
  orderNumber,
}: {
  countryId: string;
  orderNumber: string;
}) {
  return (
    <ActionForm action={riderFailAction} resetOnSuccess className="flex flex-col gap-3">
      {(state, pending) => (
        <>
          <input type="hidden" name="countryId" value={countryId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <SelectField
            name="reason"
            label="What happened?"
            defaultValue=""
            error={state.fieldErrors?.reason}
          >
            <option value="" disabled>
              Choose one
            </option>
            {DELIVERY_FAILURE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {FAILURE_REASON_LABEL[reason]}
              </option>
            ))}
          </SelectField>
          <TextField
            name="note"
            label="Note (needed for “Other reason”)"
            maxLength={DELIVERY_NOTE_MAX}
            error={state.fieldErrors?.note}
          />
          <FormMessage state={state} />
          <div>
            <SubmitButton pending={pending} variant="secondary" pendingLabel="Saving…">
              Record failed attempt
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Makes a phone photo small enough to send: at most 1280 px on the long side, JPEG. */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < 1_300_000) return url; // about 950 KB once decoded
  }
  throw new Error("too large");
}

function PhotoField({ error }: { error: string | undefined }) {
  const [photo, setPhoto] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="delivery-photo" className="text-sm font-medium text-ink">
        Photo of the order at the door
      </label>
      <input
        id="delivery-photo"
        type="file"
        accept="image/*"
        capture="environment"
        className={inputClass}
        aria-invalid={error || problem ? true : undefined}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          setProblem(null);
          if (!file) return setPhoto("");
          try {
            setPhoto(await shrinkPhoto(file));
          } catch {
            setPhoto("");
            setProblem("This photo could not be used. Take it again.");
          }
        }}
      />
      <input type="hidden" name="photo" value={photo} />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview, not a page image
        <img
          src={photo}
          alt="The photo that will be sent"
          className="mt-1 max-h-48 w-auto self-start rounded-lg border border-line"
        />
      ) : null}
      {problem || error ? (
        <p className="text-xs font-medium text-danger">{problem ?? error}</p>
      ) : null}
    </div>
  );
}

function SignatureField({ error }: { error: string | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signature, setSignature] = useState("");

  const reset = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = element.clientWidth * ratio;
    element.height = element.clientHeight * ratio;
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, element.clientWidth, element.clientHeight);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";
    setSignature("");
  }, []);

  useEffect(() => reset(), [reset]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id="signature-label" className="text-sm font-medium text-ink">
        Customer&apos;s signature
      </span>
      <canvas
        ref={canvas}
        role="img"
        aria-labelledby="signature-label"
        className="h-40 w-full touch-none rounded-lg border border-line bg-white"
        onPointerDown={(event) => {
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          const { x, y } = point(event);
          context.beginPath();
          context.moveTo(x, y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = event.currentTarget.getContext("2d");
          const { x, y } = point(event);
          context?.lineTo(x, y);
          context?.stroke();
        }}
        onPointerUp={(event) => {
          drawing.current = false;
          setSignature(event.currentTarget.toDataURL("image/png"));
        }}
      />
      <input type="hidden" name="signature" value={signature} />
      <div className="flex items-center justify-between gap-3">
        <p className={error ? "text-xs font-medium text-danger" : "text-xs text-muted"}>
          {error ?? "The customer signs with a finger."}
        </p>
        <button type="button" className={buttonClass.quiet} onClick={reset}>
          Clear
        </button>
      </div>
    </div>
  );
}

/** Kept checked across a refused attempt (a wrong code), unlike an uncontrolled field that the form resets. */
function CashCollected({ cashText, error }: { cashText: string; error: string | undefined }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-start gap-3 rounded-lg border border-line bg-raised px-4 py-3 text-sm text-ink">
      <input
        type="checkbox"
        name="cashCollected"
        value="yes"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
      />
      <span>
        I have collected <strong className="tabular-nums">{cashText}</strong> in cash.
        {error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : null}
      </span>
    </label>
  );
}

/**
 * Submitted from script, not as a form action: a refused attempt (a wrong
 * code) must keep what the rider entered, and React resets a form after a
 * form action. The form needs JavaScript anyway (camera photo, signature).
 * Success is announced from the submit handler: the page then shows the
 * order as delivered and this form is gone before an effect could run.
 */
export function DeliverForm({
  countryId,
  orderNumber,
  cashText,
}: {
  countryId: string;
  orderNumber: string;
  cashText: string | null;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await riderDeliverAction(IDLE, data);
          if (result.status === "ok" && result.message) showToast(result.message, "success");
          setState(result);
        });
      }}
    >
      <>
        <input type="hidden" name="countryId" value={countryId} />
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <TextField
          name="code"
          label="Customer's delivery code"
          hint="The customer sees a 6-digit code on their order page. Ask for it only when they have the order in hand."
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          error={state.fieldErrors?.code}
        />
        {cashText ? (
          <CashCollected cashText={cashText} error={state.fieldErrors?.cashCollected} />
        ) : null}
        <PhotoField error={state.fieldErrors?.photo} />
        <SignatureField error={state.fieldErrors?.signature} />
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Mark as delivered
        </SubmitButton>
      </>
    </form>
  );
}
