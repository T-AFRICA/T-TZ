"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formText } from "@/features/rules";
import { countryApiFor } from "@/server/country-api";
import { requireAdmin } from "@/server/session";
import { notificationAudiences } from "./audiences";

/**
 * "Mark all as read" on the notifications page. It moves the
 * administrator's own "seen up to here" mark in the country, per audience,
 * to the newest notification the page showed.
 *
 * Here: the administrator from the verified session; the country, which
 * must be one of theirs; the audiences, worked out from their roles and
 * never taken from the form. The country checks each request again and
 * never lets one administrator move another's mark. It changes nothing but
 * that mark, so it is not written to the audit log.
 */
const through = z
  .string()
  .regex(/^[1-9][0-9]{0,15}$/)
  .transform(Number);

export async function markNotificationsSeenAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const countryId = formText(form, "countryId");
  const country = /^[a-z][a-z0-9_]{1,23}$/.test(countryId) ? admin.countries.find((candidate) => candidate.id === countryId) : undefined;
  if (!country) return;
  const audiences = notificationAudiences(admin.actor, country.id);
  if (audiences.length === 0) return;

  const api = await countryApiFor(admin, country);
  await Promise.all(
    audiences.map(async (audience) => {
      const parsed = through.safeParse(formText(form, `through_${audience}`));
      if (!parsed.success) return;
      const result = await api.markNotificationsSeen(admin.actor.userId, audience, parsed.data);
      if (!result.available) console.error("admin: notifications could not be marked as read", { audience, reason: result.reason });
    }),
  );
  revalidatePath(`/c/${country.id}/notifications`);
}
