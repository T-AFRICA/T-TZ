import type { Metadata } from "next";
import { listAdministrators, listPendingInvitations } from "@tronic/database/admin";
import { COUNTRY_ROLE_KEYS, ROLES, canGrantRole, canSuspend, isRoleKey } from "@tronic/permissions";
import { InviteForm } from "@/components/console-forms";
import { AdministratorsTable, InvitationsTable } from "@/components/people";
import { Notice, PageHeader, Panel } from "@/components/ui";
import { getAdminDb } from "@/server/db";
import { requireGlobalPermission } from "@/server/session";

export const metadata: Metadata = { title: "Administrators" };

export default async function AdministratorsPage() {
  const admin = await requireGlobalPermission("global.admins.manage");
  const db = getAdminDb();
  const [people, invitations] = await Promise.all([listAdministrators(db, admin.access), listPendingInvitations(db, admin.access)]);
  const countryName = (countryId: string | null) => admin.countries.find((country) => country.id === countryId)?.name ?? "All countries";
  const isMasterAccount = (userId: string) =>
    people.find((person) => person.userId === userId)?.assignments.some((assignment) => assignment.role === "master_super_admin") ?? false;

  return (
    <>
      <PageHeader
        eyebrow="Master Super Admin"
        title="Administrators"
        description="Everyone with access to this console, in every country. Country Super Admins manage their own staff from their country's Staff page."
      />

      <Panel title="Give a role" description="An existing administrator gets the role at once. Anyone else gets it the first time they sign in with that confirmed email address.">
        <InviteForm
          countries={admin.countries.map((country) => ({ id: country.id, name: country.name }))}
          roles={COUNTRY_ROLE_KEYS.map((key) => ({ key, name: ROLES[key].name }))}
        />
        <div className="mt-4">
          <Notice tone="neutral">
            The Master Super Admin role is not in this list on purpose: it is given only by the provisioning step an owner runs in the database, never from this console.
          </Notice>
        </div>
      </Panel>

      <Panel title="All administrators" flush>
        <AdministratorsTable
          people={people}
          countryName={countryName}
          viewerId={admin.actor.userId}
          canRevoke={(role, countryId, userId) => isRoleKey(role) && canGrantRole(admin.actor, role, countryId, userId)}
          canSuspend={(person) => canSuspend(admin.actor, { userId: person.userId, isMaster: isMasterAccount(person.userId) })}
        />
      </Panel>

      <Panel id="invitations" title="Pending invitations" description="Roles waiting for a first sign-in. An invitation lasts seven days." flush>
        <InvitationsTable invitations={invitations} countryName={countryName} showCountry />
      </Panel>
    </>
  );
}
