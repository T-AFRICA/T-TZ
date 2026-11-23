"use client";

import { useEffect } from "react";

/** The event the notifications page sends to the bell in the header. */
export const UNREAD_EVENT = "tronic-admin-unread";

/**
 * Renders nothing. The notifications page has just counted the unread
 * notifications on the server; this hands the number to the bell in the
 * header, so it changes the moment they are marked as read.
 */
export function UnreadSync({ count }: { count: number }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<number>(UNREAD_EVENT, { detail: count }));
  }, [count]);
  return null;
}
