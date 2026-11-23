"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useSignedInHint } from "@/features/auth/sessionHint";

/**
 * The unread-notification count for the bell in the header and the
 * account navigation. One number shared by every badge on the page, asked
 * from the server at most once a minute and when the tab is looked at
 * again. It is a label: the notifications page reads the real list on the
 * server, for the verified session.
 */
const REFRESH_MS = 60_000;

let unread = 0;
let fetchedAt = 0;
let pending = false;
const listeners = new Set<() => void>();

function publish(value: number) {
  const next = Number.isSafeInteger(value) && value > 0 ? value : 0;
  if (next === unread) return;
  unread = next;
  for (const listener of listeners) listener();
}

/** The notifications page tells the badges what the server just counted. */
export function setUnreadNotifications(value: number) {
  fetchedAt = Date.now();
  publish(value);
}

async function refresh(force = false) {
  if (pending || (!force && Date.now() - fetchedAt < REFRESH_MS)) return;
  pending = true;
  try {
    const response = await fetch("/api/account/notifications/unread", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const body: unknown = await response.json();
      const value = (body as { unread?: unknown } | null)?.unread;
      fetchedAt = Date.now();
      publish(typeof value === "number" ? value : 0);
    }
  } catch {
    // Offline or interrupted: keep the last number.
  } finally {
    pending = false;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** How many notifications the signed-in customer has not read; 0 when signed out and until first asked. */
export function useUnreadNotifications(): number {
  const signedIn = useSignedInHint();
  const pathname = usePathname();
  const count = useSyncExternalStore(
    subscribe,
    () => unread,
    () => 0,
  );

  useEffect(() => {
    if (!signedIn) {
      fetchedAt = 0;
      publish(0);
      return;
    }
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [signedIn, pathname]);

  return signedIn ? count : 0;
}
