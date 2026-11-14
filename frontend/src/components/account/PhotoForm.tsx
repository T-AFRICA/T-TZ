"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { photoAction, type PhotoFormState } from "@/features/account/actions";
import { AVATAR_ACCEPT } from "@/features/account/avatar";

const IDLE: PhotoFormState = { status: "idle" };
/** Photos are shown small; the browser sends at most this many pixels a side. */
const EDGE = 512;

/**
 * A centred square JPEG of at most EDGE pixels, made in the browser, or
 * null when the browser cannot read the file (the original is sent then
 * and the server decides). Re-drawing also drops the camera's metadata,
 * such as where the picture was taken.
 */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.max(1, Math.min(EDGE, side));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  } catch {
    return null;
  }
}

/**
 * The optional profile photo: choose, upload, replace or remove. A normal
 * POST form bound to a server action, so it works before JavaScript loads
 * (the file is then sent as chosen); with JavaScript the photo is made
 * small in the browser first. The server checks the session, the size and
 * the real file type either way.
 */
export function PhotoForm({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  const [state, action, pending] = useActionState(photoAction, IDLE);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  // The chosen file's preview, shown until the form gets its next answer.
  const [preview, setPreview] = useState<{ url: string; since: PhotoFormState } | null>(null);
  const shown = preview?.since === state ? preview.url : photoUrl;

  useEffect(() => {
    // An answer from the server ends the selection.
    if (state.status !== "idle" && fileRef.current) fileRef.current.value = "";
  }, [state]);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function onChoose() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const file = fileRef.current?.files?.[0];
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewUrl.current ? { url: previewUrl.current, since: state } : null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value === "remove") return;
    const file = fileRef.current?.files?.[0];
    if (!file) return; // posted as it is; the server says a photo is needed
    event.preventDefault();
    void (async () => {
      const small = await shrink(file);
      const data = new FormData();
      data.set("intent", "upload");
      if (small) data.set("photo", small, "photo.jpg");
      else data.set("photo", file);
      startTransition(() => action(data));
    })();
  }

  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <span
        aria-hidden="true"
        className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#d71920,#9e1118)] text-xl font-bold text-white"
      >
        {initials}
        {shown ? <Image src={shown} alt="" fill sizes="80px" unoptimized className="object-cover" /> : null}
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Choose a photo</span>
          <input
            ref={fileRef}
            name="photo"
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={onChoose}
            aria-describedby="profile-photo-note"
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border file:border-solid file:border-[var(--color-light-grey)] file:bg-white file:px-4 file:text-sm file:font-semibold file:text-[var(--text-primary)] hover:file:border-[var(--color-action-red)]"
          />
        </label>
        <p id="profile-photo-note" className="text-xs text-[var(--text-secondary)]">
          Optional. JPEG, PNG or WebP, up to 2 MB. Only you see it, in your account.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="upload"
            disabled={pending}
            className="inline-flex h-11 items-center rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)] disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Saving…" : "Upload photo"}
          </button>
          {photoUrl ? (
            <button
              type="submit"
              name="intent"
              value="remove"
              disabled={pending}
              className="inline-flex h-11 items-center rounded-full border border-[var(--color-light-grey)] px-5 text-sm font-semibold transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)] disabled:cursor-wait disabled:opacity-70"
            >
              Remove photo
            </button>
          ) : null}
          <p role="status" aria-live="polite" className="text-sm">
            {state.status === "saved" ? <span className="font-medium text-[#17743a]">Photo saved.</span> : null}
            {state.status === "removed" ? <span className="font-medium text-[#17743a]">Photo removed.</span> : null}
            {state.status === "error" ? <span className="font-medium text-[#b3141a]">{state.message}</span> : null}
          </p>
        </div>
      </div>
    </form>
  );
}
