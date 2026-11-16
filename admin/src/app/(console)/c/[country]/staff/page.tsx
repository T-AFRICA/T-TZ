import type { Metadata } from "next";
import { listAdministrators, listPendingInvitations } from "@tronic/database/admin";
import { ROLES, canGrantRole, canSuspend, grantableRoles, isRoleKey } from "@tronic/permissions";
import { InviteForm } from "@/components/console-forms";
import { AdministratorsTable, InvitationsTable } from "@/components/people";
import { PageHeader, Panel } from "@/components/ui";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({ params }: { params: Promise<{ country: string }> }) {
  const { admin, country } = await requireCountry((await params).country, "staff.read");
  const db = getAdminDb();
  const [people, invitations] = await Promise.all([
    listAdministrators(db, admin.access, { countryId: country.id }),
    listPendingInvitations(db, admin.access, { countryId: country.id }),
  ]);
  const roles = grantableRoles(admin.actor, country.id);
  const isMasterAccount = (userId: string) =>
    people.find((person) => person.userId === userId)?.assignments.some((assignment) => assignment.role === "master_super_admin") ?? false;

  return (
    <>
      <PageHeader
        eyebrow={country.name}
        title="Staff"
        description={`The administrators of ${country.name} and what each may do here. Roles in other countries are not shown and cannot be changed from this page.`}
      />

      {roles.length > 0 ? (
        <Panel
          title="Give a role"
          description="An existing administrator gets the role at once. Anyone else gets it the first time they sign in with that confirmed email address."
        >
          <InviteForm countries={[]} fixedCountryId={country.id} roles={roles.map((key) => ({ key, name: ROLES[key].name }))} />
        </Panel>
      ) : null}

      <Panel title={`Administrators of ${country.name}`} flush>
        <AdministratorsTable
          people={people}
          countryName={() => country.name}
          countryFilter={country.id}
          viewerId={admin.actor.userId}
          canRevoke={(role, countryId, userId) => isRoleKey(role) && canGrantRole(admin.actor, role, countryId, userId)}
          canSuspend={(person) => canSuspend(admin.actor, { userId: person.userId, isMaster: isMasterAccount(person.userId) })}
        />
      </Panel>

      <Panel title="Pending invitations" description="Roles waiting for a first sign-in. An invitation lasts seven days." flush>
        <InvitationsTable invitations={invitations} countryName={() => country.name} showCountry={false} />
      </Panel>
    </>
  );
}
