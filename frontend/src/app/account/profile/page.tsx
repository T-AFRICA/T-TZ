import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ShieldCheck } from "lucide-react";
import { ArrowRightIcon } from "@tronic/ui";
import { PhotoForm } from "@/components/account/PhotoForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Field, NotConnected, PageHeading, Panel, PortalPage } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { initials, requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Profile" };

/**
 * /account/profile — the signed-in customer's own details from Supabase
 * Auth. Name and phone can be edited (saved to the customer's own auth
 * profile); the email is the sign-in and is read-only here. A profile
 * photo is optional and private to the customer. Only customer fields are
 * shown: nothing about roles or administration.
 */
export default async function AccountProfilePage() {
  const user = await requireCustomer();
  const profile = createAccountService(user).getProfile();

  return (
    <PortalPage>
      <PageHeading eyebrow="Account" title="Profile" description="Your contact details for orders and deliveries." />

      <Panel title="Your details" labelledBy="profile-details">
        <ProfileForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} email={profile.email ?? ""} />
      </Panel>

      <Panel title="Profile photo" labelledBy="profile-photo">
        <PhotoForm photoUrl={profile.photoUrl} initials={initials(user)} />
      </Panel>

      <Panel title="Shopping region" labelledBy="profile-region">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country">{profile.country}</Field>
          <Field label="Prices and delivery">Shown for {profile.country} on this site</Field>
        </dl>
      </Panel>

      <Panel title="Communication preferences" labelledBy="profile-communication">
        <NotConnected
          icon={BellRing}
          title="Preferences are not available yet"
          body="Choosing how we contact you about orders and offers will be available here. We do not send marketing messages from this site today."
          waitingFor="an email / SMS provider and a preferences table"
        />
      </Panel>

      <Link
        href="/account/security"
        className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(17,17,17,0.3)] md:p-5"
      >
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fdf1f1] text-[var(--color-action-red)]">
          <ShieldCheck size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Account security</span>
          <span className="block text-xs text-[var(--text-secondary)]">Password, email verification and sign out</span>
        </span>
        <ArrowRightIcon size={16} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-action-red)]" />
      </Link>
    </PortalPage>
  );
}
