import type { Db, Row } from "../db";

/**
 * Server-only query layer of the CENTRAL ADMIN database
 * (database/admin-migrations). A different database from a country's:
 * it holds administrators, roles, the country roster and the audit trail,
 * and no customer, order or product data.
 *
 * Every call runs as Supabase's `authenticated` role with the caller's
 * verified user id and session assurance level in the JWT claims, so Row
 * Level Security and the checks inside the database functions decide what
 * is returned or changed. Nothing here filters by country on its own
 * authority: a caller without the role simply gets no rows or "not_allowed".
 */

/** Who a query runs as. Both values come from a verified Supabase Auth session, never from request input. */
export interface AdminAccess {
  userId: string;
  /** Authenticator assurance level of the session: "aal2" once the second factor is passed. */
  aal: "aal1" | "aal2";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` in one transaction as the given administrator. `set local`
 * ends with the transaction.
 *
 * The role, the claims and the queries of `fn` are handed to the connection
 * one after the other without waiting for each answer, so they travel
 * together: the database is often far from the server, and every wait is a
 * round trip. The order on the connection is the order here, and a
 * statement that fails aborts the transaction for everything after it, so
 * no query can run before the role is set or after it failed to be.
 */
export async function withAdminAccess<T>(db: Db, access: AdminAccess, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (!UUID.test(access.userId)) throw new Error("withAdminAccess: a user id (uuid) is required");
  if (access.aal !== "aal1" && access.aal !== "aal2") throw new Error("withAdminAccess: unknown assurance level");
  return db.transaction(async (tx) => {
    const claims = { sub: access.userId, role: "authenticated", aal: access.aal };
    const role = tx.query("set local role authenticated");
    const config = tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const work = fn(tx);
    // Wait for all three; report the first failure in the order they were sent.
    const [roleResult, configResult, workResult] = await Promise.allSettled([role, config, work]);
    if (roleResult.status === "rejected") throw roleResult.reason;
    if (configResult.status === "rejected") throw configResult.reason;
    if (workResult.status === "rejected") throw workResult.reason;
    return workResult.value;
  });
}

// ------------------------------------------------------------------ helpers --

type Json = Record<string, unknown>;

function parseJson(value: unknown): Json {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Unexpected database value: expected text");
  return value;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new Error("Unexpected database value: expected a timestamp");
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function int(value: unknown): number {
  const n = typeof value === "bigint" ? Number(value) : typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) throw new Error("Unexpected database value: expected an integer");
  return n;
}

/** Every failure code the admin database functions return. */
export type AdminErrorCode =
  | "not_allowed"
  | "invalid_request"
  | "not_found"
  | "own_account"
  | "account_suspended"
  | "already_assigned"
  | "already_invited"
  | "already_exists"
  | "not_pending"
  | "not_active"
  | "master_is_provisioned"
  | "email_not_confirmed"
  | "email_in_use";

export type AdminResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: AdminErrorCode };

function failure(result: Json): { ok: false; code: AdminErrorCode } {
  return { ok: false, code: typeof result.code === "string" ? (result.code as AdminErrorCode) : "not_allowed" };
}

async function callFunction(db: Db, access: AdminAccess, sql: string, params: readonly unknown[]): Promise<Json> {
  const [row] = await withAdminAccess(db, access, (tx) => tx.query<{ result: unknown }>(sql, params));
  return parseJson(row?.result);
}

// ------------------------------------------------------------------ session --

export interface AdminSessionRecord {
  known: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  status: "active" | "suspended" | null;
  /** Active assignments as stored: role key and country id (null for the global role). */
  assignments: { role: string; countryId: string | null }[];
  mfaRequired: boolean;
}

function toSessionRecord(result: Json): AdminSessionRecord {
  if (result.known !== true) {
    return { known: false, userId: null, email: null, fullName: null, status: null, assignments: [], mfaRequired: false };
  }
  const assignments = Array.isArray(result.assignments) ? (result.assignments as Json[]) : [];
  return {
    known: true,
    userId: text(result.user_id),
    email: text(result.email),
    fullName: nullableText(result.full_name),
    status: result.status === "suspended" ? "suspended" : "active",
    assignments: assignments.map((a) => ({ role: text(a.role), countryId: nullableText(a.country_id) })),
    mfaRequired: result.mfa_required === true,
  };
}

/** The caller's own profile and active roles. Answers before the second factor; never about anyone else. */
export async function getAdminSession(db: Db, access: AdminAccess): Promise<AdminSessionRecord> {
  return toSessionRecord(await callFunction(db, access, `select admin_session() as result`, []));
}

/**
 * What every console request needs first, read together in one
 * transaction: the caller's own record and the countries they may see
 * (none while the caller does not count as an administrator).
 */
export async function loadAdminSession(db: Db, access: AdminAccess): Promise<{ record: AdminSessionRecord; countries: AdminCountry[] }> {
  const [sessionRows, countryRows] = await withAdminAccess(db, access, (tx) =>
    Promise.all([
      tx.query<{ result: unknown }>(`select admin_session() as result`),
      tx.query(`select ${COUNTRY_COLUMNS} from countries c order by c.sort_order, c.name`),
    ]),
  );
  return { record: toSessionRecord(parseJson(sessionRows[0]?.result)), countries: countryRows.map(rowToCountry) };
}

/** Turns pending invitations for the caller's confirmed email into roles. */
export async function acceptAdminInvitations(db: Db, access: AdminAccess): Promise<AdminResult<{ accepted: number }>> {
  const result = await callFunction(db, access, `select accept_admin_invitations() as result`, []);
  return result.ok === true ? { ok: true, accepted: int(result.accepted) } : failure(result);
}

// ---------------------------------------------------------------- countries --

export type CountryStatus = "active" | "planned" | "pending_confirmation" | "suspended";

export interface AdminCountry {
  id: string;
  name: string;
  isoCode: string | null;
  currency: string | null;
  timezone: string | null;
  websiteDomain: string | null;
  status: CountryStatus;
  updatedAt: string;
}

const COUNTRY_COLUMNS = `c.id, c.name, c.iso_code, c.currency, c.timezone, c.website_domain, c.status, c.updated_at`;

function rowToCountry(row: Row): AdminCountry {
  return {
    id: text(row.id),
    name: text(row.name),
    isoCode: nullableText(row.iso_code)?.trim() ?? null,
    currency: nullableText(row.currency)?.trim() ?? null,
    timezone: nullableText(row.timezone),
    websiteDomain: nullableText(row.website_domain),
    status: text(row.status) as CountryStatus,
    updatedAt: iso(row.updated_at),
  };
}

/** The countries the caller has a role in (every country for a Master Super Admin). */
export async function listAdminCountries(db: Db, access: AdminAccess): Promise<AdminCountry[]> {
  const rows = await withAdminAccess(db, access, (tx) => tx.query(`select ${COUNTRY_COLUMNS} from countries c order by c.sort_order, c.name`));
  return rows.map(rowToCountry);
}

export async function getAdminCountry(db: Db, access: AdminAccess, countryId: string): Promise<AdminCountry | null> {
  const rows = await withAdminAccess(db, access, (tx) => tx.query(`select ${COUNTRY_COLUMNS} from countries c where c.id = $1`, [countryId]));
  return rows[0] ? rowToCountry(rows[0]) : null;
}

export interface CountryHealthCheck {
  checkedAt: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  errorCode: string | null;
}

export interface CountryService {
  countryId: string;
  apiBaseUrl: string | null;
  vercelProject: string | null;
  supabaseProjectRef: string | null;
  enabled: boolean;
  updatedAt: string;
  /** The most recent real request to the service, or null when it was never asked. */
  lastCheck: CountryHealthCheck | null;
}

/** Service registry rows the caller may see (settings.read in the country), with each one's latest health check. */
export async function listCountryServices(db: Db, access: AdminAccess): Promise<CountryService[]> {
  const rows = await withAdminAccess(db, access, (tx) =>
    tx.query(
      `select s.country_id, s.api_base_url, s.vercel_project, s.supabase_project_ref, s.enabled, s.updated_at,
              h.checked_at, h.ok, h.status_code, h.latency_ms, h.error_code
         from country_service_registry s
         left join lateral (select * from country_health_checks k
                             where k.country_id = s.country_id
                             order by k.checked_at desc, k.id desc limit 1) h on true
        order by s.country_id`,
    ),
  );
  return rows.map((row) => ({
    countryId: text(row.country_id),
    apiBaseUrl: nullableText(row.api_base_url),
    vercelProject: nullableText(row.vercel_project),
    supabaseProjectRef: nullableText(row.supabase_project_ref),
    enabled: row.enabled === true,
    updatedAt: iso(row.updated_at),
    lastCheck:
      row.checked_at === null || row.checked_at === undefined
        ? null
        : {
            checkedAt: iso(row.checked_at),
            ok: row.ok === true,
            statusCode: row.status_code === null ? null : int(row.status_code),
            latencyMs: row.latency_ms === null ? null : int(row.latency_ms),
            errorCode: nullableText(row.error_code),
          },
  }));
}

export interface CountryPatch {
  name?: string;
  isoCode?: string | null;
  currency?: string | null;
  timezone?: string | null;
  websiteDomain?: string | null;
  status?: CountryStatus;
}

export async function updateCountry(db: Db, access: AdminAccess, countryId: string, patch: CountryPatch): Promise<AdminResult> {
  const body: Json = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.isoCode !== undefined) body.iso_code = patch.isoCode;
  if (patch.currency !== undefined) body.currency = patch.currency;
  if (patch.timezone !== undefined) body.timezone = patch.timezone;
  if (patch.websiteDomain !== undefined) body.website_domain = patch.websiteDomain;
  if (patch.status !== undefined) body.status = patch.status;
  const result = await callFunction(db, access, `select update_country($1, $2::text::jsonb) as result`, [countryId, JSON.stringify(body)]);
  return result.ok === true ? { ok: true } : failure(result);
}

export interface CountryServicePatch {
  apiBaseUrl?: string | null;
  vercelProject?: string | null;
  supabaseProjectRef?: string | null;
  enabled?: boolean;
}

export async function updateCountryService(db: Db, access: AdminAccess, countryId: string, patch: CountryServicePatch): Promise<AdminResult> {
  const body: Json = {};
  if (patch.apiBaseUrl !== undefined) body.api_base_url = patch.apiBaseUrl;
  if (patch.vercelProject !== undefined) body.vercel_project = patch.vercelProject;
  if (patch.supabaseProjectRef !== undefined) body.supabase_project_ref = patch.supabaseProjectRef;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  const result = await callFunction(db, access, `select update_country_service($1, $2::text::jsonb) as result`, [countryId, JSON.stringify(body)]);
  return result.ok === true ? { ok: true } : failure(result);
}

export async function recordCountryHealthCheck(
  db: Db,
  access: AdminAccess,
  countryId: string,
  check: { ok: boolean; statusCode: number | null; latencyMs: number | null; errorCode: string | null },
): Promise<AdminResult> {
  const result = await callFunction(
    db,
    access,
    `select record_country_health_check($1, $2::boolean, $3::integer, $4::integer, $5) as result`,
    [countryId, check.ok, check.statusCode, check.latencyMs, check.errorCode],
  );
  return result.ok === true ? { ok: true } : failure(result);
}

// ----------------------------------------------------------- administrators --

export interface AdministratorAssignment {
  id: string;
  role: string;
  countryId: string | null;
  grantedAt: string;
}

export interface Administrator {
  userId: string;
  email: string;
  fullName: string | null;
  status: "active" | "suspended";
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  /** Active assignments the caller is allowed to see. */
  assignments: AdministratorAssignment[];
}

/**
 * Administrators the caller may see, each with the active roles the caller
 * may see. With `countryId`, only people holding a role in that country.
 */
export async function listAdministrators(db: Db, access: AdminAccess, options: { countryId?: string } = {}): Promise<Administrator[]> {
  const rows = await withAdminAccess(db, access, (tx) =>
    tx.query(
      `select p.user_id, p.email, p.full_name, p.status, p.suspended_at, p.suspension_reason, p.created_at,
              coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'role', a.role_key, 'country_id', a.country_id,
                                                           'granted_at', a.granted_at)
                                         order by a.country_id nulls first, r.sort_order)
                          from admin_role_assignments a
                          join roles r on r.key = a.role_key
                         where a.user_id = p.user_id and a.revoked_at is null), '[]'::jsonb) as assignments
         from admin_profiles p
        where $1::text is null
           or exists (select 1 from admin_role_assignments a
                       where a.user_id = p.user_id and a.country_id = $1 and a.revoked_at is null)
        order by p.email`,
      [options.countryId ?? null],
    ),
  );
  return rows.map((row) => {
    const raw: unknown = typeof row.assignments === "string" ? JSON.parse(row.assignments) : row.assignments;
    const assignments = (Array.isArray(raw) ? (raw as Json[]) : []).map((a) => ({
      id: text(a.id),
      role: text(a.role),
      countryId: nullableText(a.country_id),
      grantedAt: iso(a.granted_at),
    }));
    return {
      userId: text(row.user_id),
      email: text(row.email),
      fullName: nullableText(row.full_name),
      status: row.status === "suspended" ? ("suspended" as const) : ("active" as const),
      suspendedAt: nullableIso(row.suspended_at),
      suspensionReason: nullableText(row.suspension_reason),
      createdAt: iso(row.created_at),
      assignments,
    };
  });
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: string;
  countryId: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  /** The name and phone typed with the invitation (admin migration 0004); null otherwise. */
  name: string | null;
  phone: string | null;
}

/** Invitations still waiting, in the countries whose staff the caller may see. */
export async function listPendingInvitations(db: Db, access: AdminAccess, options: { countryId?: string } = {}): Promise<AdminInvitation[]> {
  const rows = await withAdminAccess(db, access, (tx) =>
    tx.query(
      // to_jsonb: the name and phone columns exist only from admin migration 0004 on.
      `select i.id, i.email, i.role_key, i.country_id, i.created_at, i.expires_at, i.expires_at <= now() as expired,
              to_jsonb(i) ->> 'full_name' as full_name, to_jsonb(i) ->> 'phone' as phone
         from admin_invitations i
        where i.accepted_at is null and i.revoked_at is null
          and ($1::text is null or i.country_id = $1)
        order by i.created_at desc`,
      [options.countryId ?? null],
    ),
  );
  return rows.map((row) => ({
    id: text(row.id),
    email: text(row.email),
    role: text(row.role_key),
    countryId: text(row.country_id),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    expired: row.expired === true,
    name: nullableText(row.full_name),
    phone: nullableText(row.phone),
  }));
}

/**
 * Gives a role to an email address: assigned at once to an existing
 * administrator, otherwise an invitation. A name or phone (admin migration
 * 0004) goes with it; without either the 0001 function is used, so inviting
 * keeps working before 0004 is applied.
 */
export async function inviteAdmin(
  db: Db,
  access: AdminAccess,
  input: { email: string; role: string; countryId: string; name?: string | null; phone?: string | null },
): Promise<AdminResult<{ outcome: "granted" | "invited"; contactSaved: boolean }>> {
  let contactSaved = Boolean(input.name || input.phone);
  let result: Json | null = null;
  if (contactSaved) {
    try {
      result = await callFunction(db, access, `select invite_admin($1, $2, $3, $4, $5) as result`, [input.email, input.role, input.countryId, input.name ?? null, input.phone ?? null]);
    } catch (error) {
      // Before admin migration 0004: give the role without the name and phone, and say so.
      if ((error as { code?: unknown } | null)?.code !== "42883") throw error;
      contactSaved = false;
    }
  }
  result ??= await callFunction(db, access, `select invite_admin($1, $2, $3) as result`, [input.email, input.role, input.countryId]);
  return result.ok === true ? { ok: true, outcome: result.outcome === "granted" ? "granted" : "invited", contactSaved } : failure(result);
}

export async function revokeAdminInvitation(db: Db, access: AdminAccess, invitationId: string): Promise<AdminResult> {
  if (!UUID.test(invitationId)) return { ok: false, code: "invalid_request" };
  const result = await callFunction(db, access, `select revoke_admin_invitation($1::uuid) as result`, [invitationId]);
  return result.ok === true ? { ok: true } : failure(result);
}

export async function revokeAdminRole(db: Db, access: AdminAccess, assignmentId: string): Promise<AdminResult> {
  if (!UUID.test(assignmentId)) return { ok: false, code: "invalid_request" };
  const result = await callFunction(db, access, `select revoke_admin_role($1::uuid) as result`, [assignmentId]);
  return result.ok === true ? { ok: true } : failure(result);
}

/** Suspends or reinstates an account (Master Super Admin only; the database refuses anyone else). */
export async function setAdminStatus(
  db: Db,
  access: AdminAccess,
  input: { userId: string; status: "active" | "suspended"; reason?: string | null },
): Promise<AdminResult<{ changed: boolean }>> {
  if (!UUID.test(input.userId)) return { ok: false, code: "invalid_request" };
  const result = await callFunction(db, access, `select set_admin_status($1::uuid, $2, $3) as result`, [
    input.userId,
    input.status,
    input.reason ?? null,
  ]);
  return result.ok === true ? { ok: true, changed: result.changed === true } : failure(result);
}

// -------------------------------------------------------------------- audit --

export interface AuditEntry {
  id: number;
  occurredAt: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  countryId: string | null;
  targetType: string | null;
  targetId: string | null;
  summary: Record<string, unknown>;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const AUDIT_PAGE_SIZE = 25;

/**
 * The audit trail the caller may read: every entry for a Master Super
 * Admin; for others the entries of countries where they hold audit.read
 * (never the global ones). `countryId` narrows it; "global" selects the
 * entries without a country.
 */
export async function listAuditLog(
  db: Db,
  access: AdminAccess,
  query: { countryId?: string | "global"; page?: number } = {},
): Promise<AuditPage> {
  const page = Number.isSafeInteger(query.page) && (query.page as number) > 0 ? (query.page as number) : 1;
  const scope = query.countryId ?? null;
  const rows = await withAdminAccess(db, access, (tx) =>
    tx.query(
      `select l.id, l.occurred_at, l.actor_id, l.actor_email, l.action, l.country_id, l.target_type, l.target_id, l.summary,
              count(*) over () as total
         from audit_logs l
        where $1::text is null
           or ($1 = 'global' and l.country_id is null)
           or l.country_id = $1
        order by l.occurred_at desc, l.id desc
        limit $2 offset $3`,
      [scope, AUDIT_PAGE_SIZE, (page - 1) * AUDIT_PAGE_SIZE],
    ),
  );
  const total = rows[0] ? int(rows[0].total) : 0;
  return {
    entries: rows.map((row) => ({
      id: int(row.id),
      occurredAt: iso(row.occurred_at),
      actorId: nullableText(row.actor_id),
      actorEmail: nullableText(row.actor_email),
      action: text(row.action),
      countryId: nullableText(row.country_id),
      targetType: nullableText(row.target_type),
      targetId: nullableText(row.target_id),
      summary: parseJson(row.summary),
    })),
    total,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}

export type SecurityEventKind = "permission_denied" | "country_denied" | "suspended_access" | "mfa_required";

/** Records an attempt the application refused. Never throws: reporting must not break the refusal itself. */
export async function recordSecurityEvent(
  db: Db,
  access: AdminAccess,
  event: { kind: SecurityEventKind; countryId?: string | null; detail?: Record<string, string | number | boolean | null> },
): Promise<void> {
  try {
    await withAdminAccess(db, access, (tx) =>
      tx.query(`select record_security_event($1, $2, $3::text::jsonb)`, [event.kind, event.countryId ?? null, JSON.stringify(event.detail ?? {})]),
    );
  } catch (error) {
    console.error("admin: could not record a security event", { kind: event.kind, error: error instanceof Error ? error.name : "unknown" });
  }
}

export interface SecurityEvent {
  id: number;
  occurredAt: string;
  kind: string;
  actorId: string | null;
  countryId: string | null;
  detail: Record<string, unknown>;
}

/** Recent refused attempts (Master Super Admin only; others get no rows). */
export async function listSecurityEvents(db: Db, access: AdminAccess, limit = 50): Promise<SecurityEvent[]> {
  const rows = await withAdminAccess(db, access, (tx) =>
    tx.query(`select id, occurred_at, kind, actor_id, country_id, detail from security_events order by occurred_at desc, id desc limit $1`, [
      Math.min(Math.max(Math.trunc(limit), 1), 200),
    ]),
  );
  return rows.map((row) => ({
    id: int(row.id),
    occurredAt: iso(row.occurred_at),
    kind: text(row.kind),
    actorId: nullableText(row.actor_id),
    countryId: nullableText(row.country_id),
    detail: parseJson(row.detail),
  }));
}

// ---------------------------------------------------------------- overview --

export interface AdminOverview {
  countries: number;
  activeCountries: number;
  administrators: number;
  suspendedAdministrators: number;
  pendingInvitations: number;
  connectedServices: number;
}

/**
 * Counts for the dashboard, over the rows the caller may see: a Country
 * Super Admin's numbers are their country's, a Master Super Admin's cover
 * every country. Only this database is counted; nothing here is country
 * business data.
 */
export async function getAdminOverview(db: Db, access: AdminAccess): Promise<AdminOverview> {
  const [row] = await withAdminAccess(db, access, (tx) =>
    tx.query(
      `select (select count(*) from countries) as countries,
              (select count(*) from countries where status = 'active') as active_countries,
              (select count(*) from admin_profiles) as administrators,
              (select count(*) from admin_profiles where status = 'suspended') as suspended_administrators,
              (select count(*) from admin_invitations
                where accepted_at is null and revoked_at is null and expires_at > now()) as pending_invitations,
              (select count(*) from country_service_registry where enabled) as connected_services`,
    ),
  );
  if (!row) throw new Error("getAdminOverview: no result");
  return {
    countries: int(row.countries),
    activeCountries: int(row.active_countries),
    administrators: int(row.administrators),
    suspendedAdministrators: int(row.suspended_administrators),
    pendingInvitations: int(row.pending_invitations),
    connectedServices: int(row.connected_services),
  };
}

// ------------------------------------------------- reaching a country (0002) --

export interface CountryEndpoint {
  countryId: string;
  isoCode: string | null;
  apiBaseUrl: string | null;
  enabled: boolean;
}

/** Where a country's service is, for an administrator with any role in that country; null for anyone else. */
export async function getCountryEndpoint(db: Db, access: AdminAccess, countryId: string): Promise<CountryEndpoint | null> {
  const [row] = await withAdminAccess(db, access, (tx) => tx.query<{ result: unknown }>(`select admin_country_endpoint($1) as result`, [countryId]));
  const raw: unknown = typeof row?.result === "string" ? JSON.parse(row.result) : row?.result;
  if (!raw || typeof raw !== "object") return null;
  const result = raw as Json;
  return {
    countryId: text(result.country_id),
    isoCode: nullableText(result.iso_code)?.trim() ?? null,
    apiBaseUrl: nullableText(result.api_base_url),
    enabled: result.enabled === true,
  };
}

export type CountryAction =
  | "order.status_change"
  | "order.note_add"
  | "delivery.assign"
  | "delivery.pickup"
  | "delivery.start"
  | "delivery.deliver"
  | "delivery.fail"
  // Products (admin migration 0005, country migration 0016).
  | "product.create"
  | "product.update"
  | "product.publish"
  | "product.hide"
  | "product.image_add"
  | "product.image_arrange"
  | "product.stock";

export interface Rider {
  userId: string;
  email: string;
  name: string | null;
  /** +<country><number>; null until set (admin migration 0004). */
  phone: string | null;
}

/** Sets a rider's name and phone (null clears the phone), for whoever may assign deliveries in that country. */
export async function setRiderContact(
  db: Db,
  access: AdminAccess,
  entry: { countryId: string; riderId: string; name: string; phone: string | null },
): Promise<AdminResult> {
  const result = await callFunction(db, access, `select admin_set_rider_contact($1, $2::uuid, $3, $4) as result`, [
    entry.countryId,
    entry.riderId,
    entry.name,
    entry.phone,
  ]);
  return result.ok === true ? { ok: true } : failure(result);
}

/**
 * The active riders of a country, for whoever may assign deliveries there;
 * empty otherwise, and empty while the database does not have riders yet
 * (admin migration 0003), so order pages keep working before it is applied.
 */
export async function listRiders(db: Db, access: AdminAccess, countryId: string): Promise<Rider[]> {
  let row: { result: unknown } | undefined;
  try {
    [row] = await withAdminAccess(db, access, (tx) => tx.query<{ result: unknown }>(`select admin_list_riders($1) as result`, [countryId]));
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "42883") return [];
    throw error;
  }
  const raw: unknown = typeof row?.result === "string" ? JSON.parse(row.result) : row?.result;
  if (!Array.isArray(raw)) return [];
  return (raw as Json[]).map((rider) => ({
    userId: text(rider.user_id),
    email: text(rider.email),
    name: nullableText(rider.name),
    phone: nullableText(rider.phone),
  }));
}

/** The audit entry for a change made in a country's own system through this console. */
export async function recordCountryAction(
  db: Db,
  access: AdminAccess,
  entry: { countryId: string; action: CountryAction; targetId: string; summary: Record<string, string | number | boolean | null> },
): Promise<AdminResult> {
  const result = await callFunction(db, access, `select record_country_action($1, $2, $3, $4::text::jsonb) as result`, [
    entry.countryId,
    entry.action,
    entry.targetId,
    JSON.stringify(entry.summary),
  ]);
  return result.ok === true ? { ok: true } : failure(result);
}
