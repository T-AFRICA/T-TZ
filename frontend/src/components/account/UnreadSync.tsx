"use client";

import { useEffect } from "react";
import { setUnreadNotifications } from "@/features/account/unread";

/**
 * Renders nothing. The notifications page has just counted the unread
 * notifications on the server; this hands that number to the badges in the
 * header and the account navigation, so they change the moment something
 * is marked read.
 */
export function UnreadSync({ count }: { count: number }) {
  useEffect(() => {
    setUnreadNotifications(count);
  }, [count]);
  return null;
}
