import {
  COUNTRY_ROLE_KEYS,
  MASTER_ROLE,
  ROLES,
  isCountryPermission,
  roleDefinition,
  type CountryPermission,
  type Permission,
  type RoleKey,
} from "./catalogue";

/**
 * Authorization decisions for the central admin. Pure functions over an
 * Actor that the server built from a verified session and the admin
 * database: never from anything the browser sent.
 *
 * The database enforces the same rules again (Row Level Security and the
 * checks inside its functions), so a mistake here cannot by itself open
 * another country's data.
 */

export interface RoleAssignment {
  role: RoleKey;
  /** Null only for a global role. */
  countryId: string | null;
}

export type AdminStatus = "active" | "suspended";

export interface Actor {
  userId: string;
  status: AdminStatus;
  /** Active (not revoked) assignments only. */
  assignments: readonly RoleAssignment[];
  /** True once this session passed the second factor (Supabase Auth AAL2). */
  mfaVerified: boolean;
}

/** Assignments that are well-formed for their role's scope; anything else is ignored. */
function validAssignments(actor: Actor): RoleAssignment[] {
  return actor.assignments.filter((assignment) => {
    const scope = ROLES[assignment.role]?.scope;
    return scope === "global" ? assignment.countryId === null : scope === "country" && Boolean(assignment.countryId);
  });
}

/** True when any of the actor's roles asks for a second factor. */
export function requiresMfa(actor: Actor): boolean {
  return validAssignments(actor).some((assignment) => roleDefinition(assignment.role).requiresMfa);
}

/**
 * An actor counts only while active, with at least one role, and with the
 * second factor passed when a role asks for it. Every decision below starts
 * here, so a suspended administrator can do nothing at all.
 */
export function isOperational(actor: Actor): boolean {
  if (actor.status !== "active") return false;
  if (validAssignments(actor).length === 0) return false;
  return !requiresMfa(actor) || actor.mfaVerified;
}

export function isMaster(actor: Actor): boolean {
  return isOperational(actor) && validAssignments(actor).some((assignment) => assignment.role === MASTER_ROLE);
}

/**
 * May the actor use `permission`? Country permissions need the country they
 * are used in; a global permission is held only by a Master Super Admin.
 */
export function can(actor: Actor, permission: Permission, countryId?: string | null): boolean {
  if (!isOperational(actor)) return false;
  if (isMaster(actor)) return true;
  if (!isCountryPermission(permission) || !countryId) return false;
  return validAssignments(actor).some(
    (assignment) => assignment.countryId === countryId && roleDefinition(assignment.role).permissions.includes(permission),
  );
}

/** Country ids the actor has any role in; "all" for a Master Super Admin. */
export function accessibleCountries(actor: Actor): "all" | string[] {
  if (!isOperational(actor)) return [];
  if (isMaster(actor)) return "all";
  return [...new Set(validAssignments(actor).flatMap((assignment) => (assignment.countryId ? [assignment.countryId] : [])))];
}

export function canAccessCountry(actor: Actor, countryId: string): boolean {
  const countries = accessibleCountries(actor);
  return countries === "all" || countries.includes(countryId);
}

/** Countries in which the actor holds `permission`; "all" for a Master Super Admin. */
export function countriesWith(actor: Actor, permission: CountryPermission): "all" | string[] {
  const countries = accessibleCountries(actor);
  return countries === "all" ? "all" : countries.filter((countryId) => can(actor, permission, countryId));
}

/** Every country permission the actor holds in one country. */
export function permissionsIn(actor: Actor, countryId: string): CountryPermission[] {
  if (!isOperational(actor)) return [];
  if (isMaster(actor)) return [...ROLES.country_super_admin.permissions];
  const held = new Set<CountryPermission>();
  for (const assignment of validAssignments(actor)) {
    if (assignment.countryId === countryId) for (const permission of roleDefinition(assignment.role).permissions) held.add(permission);
  }
  return [...held];
}

export type GrantRefusal = "not_allowed" | "master_is_provisioned" | "own_account" | "country_required" | "country_not_allowed";

/**
 * May the actor give (or take away) `role` in `countryId` to `targetUserId`?
 *
 *   - Master Super Admin is never granted through the application.
 *   - Country Super Admin: only by a Master Super Admin.
 *   - Staff roles: by a Master Super Admin, or by an administrator holding
 *     staff.manage in that same country.
 *   - Nobody changes their own roles.
 */
export function grantRefusal(actor: Actor, role: RoleKey, countryId: string | null, targetUserId: string | null): GrantRefusal | null {
  if (!isOperational(actor)) return "not_allowed";
  const definition = roleDefinition(role);
  if (definition.grantableBy === "provisioning" || definition.scope === "global") return "master_is_provisioned";
  if (!countryId) return "country_required";
  if (targetUserId !== null && targetUserId === actor.userId) return "own_account";
  if (isMaster(actor)) return null;
  if (definition.grantableBy === "master") return "not_allowed";
  return can(actor, "staff.manage", countryId) ? null : "country_not_allowed";
}

export function canGrantRole(actor: Actor, role: RoleKey, countryId: string | null, targetUserId: string | null): boolean {
  return grantRefusal(actor, role, countryId, targetUserId) === null;
}

/** Roles the actor may hand out in a country, for the "role" choice of a form. */
export function grantableRoles(actor: Actor, countryId: string): RoleKey[] {
  return COUNTRY_ROLE_KEYS.filter((role) => canGrantRole(actor, role, countryId, null));
}

/**
 * Suspension switches a whole account off, in every country, so only a
 * Master Super Admin may do it, never to themselves and never to another
 * Master Super Admin (those accounts are managed by provisioning only).
 */
export function canSuspend(actor: Actor, target: { userId: string; isMaster: boolean }): boolean {
  return isMaster(actor) && target.userId !== actor.userId && !target.isMaster;
}
