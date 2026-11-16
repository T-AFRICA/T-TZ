import type { AdminInvitation, Administrator } from "@tronic/database/admin";
import { revokeInvitationAction, revokeRoleAction, setAdminStatusAction } from "@/features/admin/actions";
import { formatDateTime, roleName } from "@/features/labels";
import { ConfirmAction } from "./forms";
import { Cell, DataTable, EmptyRow, StatusPill } from "./ui";

/**
 * Tables of administrators and invitations, shared by the global
 * Administrators page and a country's Staff page. The buttons shown follow
 * what the viewer may do; the server actions and the database decide.
 */

export function AdministratorsTable({
  people,
  countryName,
  countryFilter,
  canRevoke,
  canSuspend,
  viewerId,
}: {
  people: Administrator[];
  countryName: (countryId: string | null) => string;
  /** On a country's staff page: show only the roles of that country. */
  countryFilter?: string;
  canRevoke: (role: string, countryId: string | null, userId: string) => boolean;
  canSuspend: (person: Administrator) => boolean;
  viewerId: string;
}) {
  if (people.length === 0) return <EmptyRow title="Nobody yet" description="Give someone a role with the form above." />;
  return (
    <DataTable caption="Administrators" head={["Person", "Roles", "Status", "Since", ""]}>
      {people.map((person) => {
        const roles = person.assignments.filter((assignment) => !countryFilter || assignment.countryId === countryFilter);
        return (
          <tr key={person.userId}>
            <Cell>
              <p className="whitespace-nowrap font-semibold text-ink">{person.email}</p>
              {person.fullName ? <p className="text-xs text-muted">{person.fullName}</p> : null}
              {person.userId === viewerId ? <p className="text-xs text-muted">This is you</p> : null}
            </Cell>
            <Cell>
              {roles.length === 0 ? (
                <span className="text-muted">No roles</span>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {roles.map((assignment) => (
                    <li key={assignment.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        <span className="font-medium text-ink">{roleName(assignment.role)}</span>
                        {countryFilter ? null : <span className="text-muted"> · {countryName(assignment.countryId)}</span>}
                      </span>
                      {canRevoke(assignment.role, assignment.countryId, person.userId) ? (
                        <ConfirmAction
                          action={revokeRoleAction}
                          fields={{ id: assignment.id }}
                          label="Remove"
                          title={`Remove the ${roleName(assignment.role)} role?`}
                          description={`${person.email} loses this role in ${countryName(assignment.countryId)} at once. You can give it again later.`}
                          confirmLabel="Remove role"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Cell>
            <Cell>
              {person.status === "suspended" ? <StatusPill tone="danger">Suspended</StatusPill> : <StatusPill tone="ok">Active</StatusPill>}
              {person.suspensionReason ? <p className="mt-1 max-w-[16rem] text-xs text-muted">Reason: {person.suspensionReason}</p> : null}
            </Cell>
            <Cell className="whitespace-nowrap text-muted">{formatDateTime(person.createdAt)}</Cell>
            <Cell>
              {canSuspend(person) ? (
                person.status === "suspended" ? (
                  <ConfirmAction
                    action={setAdminStatusAction}
                    fields={{ userId: person.userId, status: "active" }}
                    label="Reinstate"
                    title="Reinstate this account?"
                    description={`${person.email} gets back every role the account still holds.`}
                    confirmLabel="Reinstate"
                    variant="secondary"
                  />
                ) : (
                  <ConfirmAction
                    action={setAdminStatusAction}
                    fields={{ userId: person.userId, status: "suspended" }}
                    label="Suspend"
                    title="Suspend this account?"
                    description={`${person.email} is stopped at once in every country, even while signed in. Roles are kept for a later reinstatement.`}
                    confirmLabel="Suspend account"
                    variant="danger"
                    reasonField={{ name: "reason", label: "Reason (optional, shown to Master Super Admins)" }}
                  />
                )
              ) : null}
            </Cell>
          </tr>
        );
      })}
    </DataTable>
  );
}

export function InvitationsTable({
  invitations,
  countryName,
  showCountry,
}: {
  invitations: AdminInvitation[];
  countryName: (countryId: string | null) => string;
  showCountry: boolean;
}) {
  if (invitations.length === 0) return <EmptyRow title="No invitations are waiting" />;
  return (
    <DataTable caption="Pending invitations" head={["Email address", "Role", ...(showCountry ? ["Country"] : []), "Sent", "Expires", ""]}>
      {invitations.map((invitation) => (
        <tr key={invitation.id}>
          <Cell className="whitespace-nowrap font-semibold text-ink">{invitation.email}</Cell>
          <Cell>{roleName(invitation.role)}</Cell>
          {showCountry ? <Cell className="text-muted">{countryName(invitation.countryId)}</Cell> : null}
          <Cell className="whitespace-nowrap text-muted">{formatDateTime(invitation.createdAt)}</Cell>
          <Cell className="whitespace-nowrap">
            {invitation.expired ? <StatusPill tone="warn">Expired</StatusPill> : <span className="text-muted">{formatDateTime(invitation.expiresAt)}</span>}
          </Cell>
          <Cell>
            <ConfirmAction
              action={revokeInvitationAction}
              fields={{ id: invitation.id }}
              label="Withdraw"
              title="Withdraw this invitation?"
              description={`${invitation.email} will not get the ${roleName(invitation.role)} role when they sign in.`}
              confirmLabel="Withdraw invitation"
            />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
