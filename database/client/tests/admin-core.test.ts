import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COUNTRY_PERMISSIONS, GLOBAL_PERMISSIONS, ROLES, ROLE_KEYS } from "@tronic/permissions";
import {
  acceptAdminInvitations,
  getAdminCountry,
  getCountryEndpoint,
  recordCountryAction,
  getAdminOverview,
  getAdminSession,
  inviteAdmin,
  listAdminCountries,
  listAdministrators,
  listAuditLog,
  listCountryServices,
  listPendingInvitations,
  listSecurityEvents,
  recordCountryHealthCheck,
  recordSecurityEvent,
  revokeAdminInvitation,
  revokeAdminRole,
  setAdminStatus,
  updateCountry,
  updateCountryService,
  withAdminAccess,
  type AdminAccess,
} from "../src/admin";
import { createAdminAuthUser, createAdminTestDatabase, type TestDatabase } from "../src/testing";

/**
 * The Central Admin database (database/admin-migrations) on a disposable
 * PGlite database that starts from Supabase's permissive defaults. Every
 * request runs as the `authenticated` role with the caller's user id and
 * assurance level in the JWT claims, the way the admin application runs
 * them, so Row Level Security, grants and the checks inside the functions
 * are what is being tested.
 */

let t: TestDatabase;

const users: Record<string, string> = {};
const mfa = (name: string): AdminAccess => ({ userId: users[name]!, aal: "aal2" });
const password = (name: string): AdminAccess => ({ userId: users[name]!, aal: "aal1" });

async function failure(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function addUser(name: string, confirmed = true): Promise<string> {
  users[name] = await createAdminAuthUser(t.db, `${name}@example.test`, confirmed);
  return users[name];
}

/** Invites `name` as `role` in `country` and has them accept by signing in. */
async function onboard(inviter: AdminAccess, name: string, role: string, country: string): Promise<void> {
  if (!users[name]) await addUser(name);
  const invited = await inviteAdmin(t.db, inviter, { email: `${name}@example.test`, role, countryId: country });
  expect(invited, `invite ${name}`).toMatchObject({ ok: true });
  if (invited.ok && invited.outcome === "invited") {
    expect(await acceptAdminInvitations(t.db, password(name))).toEqual({ ok: true, accepted: 1 });
  }
}

beforeAll(async () => {
  t = await createAdminTestDatabase();
  await addUser("master");
  // The provisioning step, as the database owner runs it in the SQL editor.
  await t.db.query(`select app_private.provision_master_super_admin('master@example.test')`);
  await onboard(mfa("master"), "tz-super", "country_super_admin", "tz");
  await onboard(mfa("master"), "ke-super", "country_super_admin", "ke");
  await onboard(mfa("tz-super"), "tz-orders", "order_manager", "tz");
  await onboard(mfa("ke-super"), "ke-support", "customer_support", "ke");
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("catalogue", () => {
  it("has the same roles and permissions as packages/permissions", async () => {
    const permissions = await t.db.query<{ key: string; scope: string; description: string }>(`select key, scope, description from permissions`);
    const expected = [
      ...Object.entries(COUNTRY_PERMISSIONS).map(([key, description]) => ({ key, scope: "country", description })),
      ...Object.entries(GLOBAL_PERMISSIONS).map(([key, description]) => ({ key, scope: "global", description })),
    ];
    const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
    expect([...permissions].sort(byKey)).toEqual(expected.sort(byKey));

    const roles = await t.db.query<{ key: string; name: string; scope: string; grantable_by: string; requires_mfa: boolean }>(
      `select key, name, scope, grantable_by, requires_mfa from roles`,
    );
    expect(roles.map((r) => r.key).sort()).toEqual([...ROLE_KEYS].sort());
    for (const role of roles) {
      const definition = ROLES[role.key as keyof typeof ROLES];
      expect({ name: role.name, scope: role.scope, grantableBy: role.grantable_by, requiresMfa: role.requires_mfa }, role.key).toEqual({
        name: definition.name,
        scope: definition.scope,
        grantableBy: definition.grantableBy,
        requiresMfa: definition.requiresMfa,
      });
      const granted = await t.db.query<{ permission_key: string }>(`select permission_key from role_permissions where role_key = $1`, [role.key]);
      expect(granted.map((g) => g.permission_key).sort(), role.key).toEqual([...definition.permissions].sort());
    }
  });

  it("lists five countries, with Congo waiting for confirmation and without a code, currency or time zone", async () => {
    const rows = await t.db.query<{ id: string; iso_code: string | null; currency: string | null; timezone: string | null; status: string }>(
      `select id, iso_code, currency, timezone, status from countries order by sort_order`,
    );
    expect(rows.map((r) => [r.id, r.iso_code, r.currency, r.status])).toEqual([
      ["tz", "TZ", "TZS", "active"],
      ["ke", "KE", "KES", "planned"],
      ["ug", "UG", "UGX", "planned"],
      ["rw", "RW", "RWF", "planned"],
      ["congo", null, null, "pending_confirmation"],
    ]);
    expect(rows.at(-1)!.timezone).toBeNull();
  });
});

describe("grants and exposure", () => {
  it("gives the anon role nothing: no table, no function", async () => {
    const tables = await t.db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'v')
          and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
               or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))`,
    );
    expect(tables).toEqual([]);
    const functions = await t.db.query<{ name: string }>(
      `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app_private') and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(functions).toEqual([]);
  });

  it("gives the authenticated role reads only, and exactly the listed functions", async () => {
    const writable = await t.db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update')
               or has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'truncate'))`,
    );
    expect(writable).toEqual([]);
    const functions = await t.db.query<{ name: string }>(
      `select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app_private') and has_function_privilege('authenticated', p.oid, 'execute')
        order by 1`,
    );
    expect(functions.map((f) => f.name)).toEqual([
      "app_private.admin_id",
      "app_private.has_country",
      "app_private.has_permission",
      "app_private.is_master",
      "public.accept_admin_invitations",
      "public.admin_country_endpoint",
      "public.admin_list_riders",
      "public.admin_session",
      "public.invite_admin",
      "public.record_country_action",
      "public.record_country_health_check",
      "public.record_security_event",
      "public.revoke_admin_invitation",
      "public.revoke_admin_role",
      "public.set_admin_status",
      "public.update_country",
      "public.update_country_service",
    ]);
  });

  it("gives the service role nothing either", async () => {
    const tables = await t.db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('service_role', c.oid, 'select')`,
    );
    expect(tables).toEqual([]);
  });

  it("has Row Level Security on every table", async () => {
    const open = await t.db.query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(open).toEqual([]);
  });

  it("refuses direct writes to every table, even for a Master Super Admin", async () => {
    const attempts = [
      `insert into admin_role_assignments (user_id, role_key, country_id) values ('${users["master"]}', 'country_super_admin', 'ke')`,
      `update admin_profiles set status = 'active'`,
      `update countries set status = 'active'`,
      `delete from audit_logs`,
      `insert into audit_logs (action) values ('x.y')`,
      `update roles set requires_mfa = false`,
      `insert into role_permissions values ('customer_support', 'staff.manage')`,
    ];
    for (const sql of attempts) {
      const message = await failure(() => withAdminAccess(t.db, mfa("master"), (tx) => tx.query(sql)));
      expect(message, sql).toMatch(/permission denied/);
    }
  });
});

describe("Master Super Admin", () => {
  it("is created only by the provisioning step, which no API role can run", async () => {
    const message = await failure(() =>
      withAdminAccess(t.db, mfa("master"), (tx) => tx.query(`select app_private.provision_master_super_admin('tz-super@example.test')`)),
    );
    expect(message).toMatch(/permission denied/);
    // No application function accepts the role.
    expect(await inviteAdmin(t.db, mfa("master"), { email: "someone@example.test", role: "master_super_admin", countryId: "tz" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "tz-super@example.test", role: "master_super_admin", countryId: "tz" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
    const masters = await t.db.query<{ email: string }>(
      `select p.email from admin_role_assignments a join admin_profiles p on p.user_id = a.user_id
        where a.role_key = 'master_super_admin' and a.revoked_at is null`,
    );
    expect(masters).toEqual([{ email: "master@example.test" }]);
  });

  it("needs a confirmed email address to be provisioned", async () => {
    await addUser("unconfirmed", false);
    expect(await failure(() => t.db.query(`select app_private.provision_master_super_admin('unconfirmed@example.test')`))).toMatch(
      /no Auth user with a confirmed email/,
    );
  });

  it("sees every country, every administrator and the whole audit log", async () => {
    expect((await listAdminCountries(t.db, mfa("master"))).map((c) => c.id)).toEqual(["tz", "ke", "ug", "rw", "congo"]);
    const admins = await listAdministrators(t.db, mfa("master"));
    expect(admins.map((a) => a.email)).toEqual(
      ["ke-super", "ke-support", "master", "tz-orders", "tz-super"].map((n) => `${n}@example.test`),
    );
    const audit = await listAuditLog(t.db, mfa("master"));
    expect(audit.entries.map((e) => e.action)).toContain("master.provision");
    expect(audit.entries.some((e) => e.countryId === "tz")).toBe(true);
    expect(audit.entries.some((e) => e.countryId === "ke")).toBe(true);
  });

  it("counts for nothing until the second factor is passed", async () => {
    const session = await getAdminSession(t.db, password("master"));
    expect(session).toMatchObject({ known: true, status: "active", mfaRequired: true });
    expect(await listAdminCountries(t.db, password("master"))).toEqual([]);
    expect(await listAdministrators(t.db, password("master"))).toEqual([]);
    expect((await listAuditLog(t.db, password("master"))).total).toBe(0);
    expect(await inviteAdmin(t.db, password("master"), { email: "new@example.test", role: "order_manager", countryId: "tz" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
  });
});

describe("country isolation", () => {
  it("shows a Tanzania Super Admin Tanzania only", async () => {
    expect((await listAdminCountries(t.db, mfa("tz-super"))).map((c) => c.id)).toEqual(["tz"]);
    expect(await getAdminCountry(t.db, mfa("tz-super"), "ke")).toBeNull();
    expect((await listCountryServices(t.db, mfa("tz-super"))).map((s) => s.countryId)).toEqual(["tz"]);
  });

  it("hides Tanzania's staff, invitations and audit log from a Kenya Super Admin", async () => {
    const admins = await listAdministrators(t.db, mfa("ke-super"));
    expect(admins.map((a) => a.email).sort()).toEqual(["ke-super@example.test", "ke-support@example.test"]);
    expect(await listAdministrators(t.db, mfa("ke-super"), { countryId: "tz" })).toEqual([]);

    await addUser("tz-pending");
    expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "tz-pending@example.test", role: "content_manager", countryId: "tz" })).toMatchObject({
      ok: true,
      outcome: "invited",
    });
    expect(await listPendingInvitations(t.db, mfa("ke-super"))).toEqual([]);
    expect((await listPendingInvitations(t.db, mfa("tz-super"))).map((i) => i.email)).toEqual(["tz-pending@example.test"]);

    const audit = await listAuditLog(t.db, mfa("ke-super"));
    expect(audit.total).toBeGreaterThan(0);
    expect(audit.entries.every((e) => e.countryId === "ke")).toBe(true);
    // Asking for Tanzania by name changes nothing: the rows are not theirs.
    expect((await listAuditLog(t.db, mfa("ke-super"), { countryId: "tz" })).total).toBe(0);
    expect((await listAuditLog(t.db, mfa("ke-super"), { countryId: "global" })).total).toBe(0);
  });

  it("shows an administrator who works in two countries only the roles of the country the viewer manages", async () => {
    await onboard(mfa("tz-super"), "ke-support", "customer_support", "tz");
    const seenByTz = (await listAdministrators(t.db, mfa("tz-super"))).find((a) => a.email === "ke-support@example.test");
    expect(seenByTz?.assignments.map((a) => [a.role, a.countryId])).toEqual([["customer_support", "tz"]]);
    const seenByMaster = (await listAdministrators(t.db, mfa("master"))).find((a) => a.email === "ke-support@example.test");
    expect(seenByMaster?.assignments.map((a) => a.countryId).sort()).toEqual(["ke", "tz"]);
  });

  it("gives staff their own profile and nothing about their colleagues", async () => {
    const admins = await listAdministrators(t.db, password("tz-orders"));
    expect(admins.map((a) => a.email)).toEqual(["tz-orders@example.test"]);
    expect((await listAuditLog(t.db, password("tz-orders"))).total).toBe(0);
    expect(await listCountryServices(t.db, password("tz-orders"))).toEqual([]);
    expect((await listAdminCountries(t.db, password("tz-orders"))).map((c) => c.id)).toEqual(["tz"]);
  });
});

describe("privilege escalation", () => {
  it("does not let a Country Super Admin create a Country Super Admin, at home or abroad", async () => {
    for (const country of ["tz", "ke"]) {
      expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "friend@example.test", role: "country_super_admin", countryId: country })).toEqual({
        ok: false,
        code: "not_allowed",
      });
    }
  });

  it("does not let a Country Super Admin assign staff in another country", async () => {
    expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "friend@example.test", role: "order_manager", countryId: "ke" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
    const events = await listSecurityEvents(t.db, mfa("master"));
    expect(events.some((e) => e.kind === "grant_denied" && e.countryId === "ke" && e.actorId === users["tz-super"])).toBe(true);
  });

  it("does not let staff invite anyone or remove anyone's role", async () => {
    expect(await inviteAdmin(t.db, password("tz-orders"), { email: "friend@example.test", role: "customer_support", countryId: "tz" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
    const [target] = await t.db.query<{ id: string }>(
      `select id from admin_role_assignments where user_id = $1 and role_key = 'country_super_admin'`,
      [users["tz-super"]],
    );
    expect(await revokeAdminRole(t.db, password("tz-orders"), target!.id)).toEqual({ ok: false, code: "not_allowed" });
  });

  it("does not let anyone give themselves a role or remove their own", async () => {
    expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "tz-super@example.test", role: "order_manager", countryId: "tz" })).toEqual({
      ok: false,
      code: "own_account",
    });
    await onboard(mfa("master"), "tz-super", "product_manager", "tz");
    const [own] = await t.db.query<{ id: string }>(
      `select id from admin_role_assignments where user_id = $1 and role_key = 'product_manager' and revoked_at is null`,
      [users["tz-super"]],
    );
    expect(await revokeAdminRole(t.db, mfa("tz-super"), own!.id)).toEqual({ ok: false, code: "own_account" });
    expect(await revokeAdminRole(t.db, mfa("master"), own!.id)).toEqual({ ok: true });
  });

  it("does not let a Kenya Super Admin remove a Tanzania role or touch the master role", async () => {
    const [tzRole] = await t.db.query<{ id: string }>(
      `select id from admin_role_assignments where user_id = $1 and role_key = 'order_manager' and revoked_at is null`,
      [users["tz-orders"]],
    );
    expect(await revokeAdminRole(t.db, mfa("ke-super"), tzRole!.id)).toEqual({ ok: false, code: "not_allowed" });
    const [masterRole] = await t.db.query<{ id: string }>(`select id from admin_role_assignments where role_key = 'master_super_admin'`);
    expect(await revokeAdminRole(t.db, mfa("master"), masterRole!.id)).toEqual({ ok: false, code: "not_allowed" });
    expect(await revokeAdminRole(t.db, mfa("ke-super"), masterRole!.id)).toEqual({ ok: false, code: "not_allowed" });
  });

  it("refuses an assignment whose country does not fit the role, even for the owner", async () => {
    expect(
      await failure(() =>
        t.db.query(`insert into admin_role_assignments (user_id, role_key, country_id) values ($1, 'master_super_admin', 'tz')`, [users["tz-super"]]),
      ),
    ).toMatch(/does not fit/);
    expect(
      await failure(() =>
        t.db.query(`insert into admin_role_assignments (user_id, role_key, country_id) values ($1, 'order_manager', null)`, [users["tz-super"]]),
      ),
    ).toMatch(/does not fit/);
  });
});

describe("invitations", () => {
  it("need the invited person's email address to be confirmed", async () => {
    await addUser("late", false);
    expect(await inviteAdmin(t.db, mfa("tz-super"), { email: "late@example.test", role: "finance_viewer", countryId: "tz" })).toMatchObject({ ok: true });
    expect(await acceptAdminInvitations(t.db, password("late"))).toEqual({ ok: false, code: "email_not_confirmed" });
    expect((await getAdminSession(t.db, password("late"))).known).toBe(false);
  });

  it("give a signed-in stranger nothing", async () => {
    await addUser("stranger");
    expect(await acceptAdminInvitations(t.db, password("stranger"))).toEqual({ ok: true, accepted: 0 });
    expect(await getAdminSession(t.db, password("stranger"))).toMatchObject({ known: false, assignments: [] });
    expect(await listAdminCountries(t.db, password("stranger"))).toEqual([]);
    expect(await listAdministrators(t.db, password("stranger"))).toEqual([]);
  });

  it("are refused twice, can be withdrawn, and are worthless once the inviter loses the right to give the role", async () => {
    await addUser("candidate");
    const invite = { email: "Candidate@Example.test ", role: "inventory_manager", countryId: "tz" };
    expect(await inviteAdmin(t.db, mfa("tz-super"), invite)).toMatchObject({ ok: true, outcome: "invited" });
    expect(await inviteAdmin(t.db, mfa("tz-super"), invite)).toEqual({ ok: false, code: "already_invited" });

    const [pending] = (await listPendingInvitations(t.db, mfa("tz-super"))).filter((i) => i.email === "candidate@example.test");
    expect(await revokeAdminInvitation(t.db, mfa("ke-super"), pending!.id)).toEqual({ ok: false, code: "not_allowed" });
    expect(await revokeAdminInvitation(t.db, mfa("tz-super"), pending!.id)).toEqual({ ok: true });
    expect(await revokeAdminInvitation(t.db, mfa("tz-super"), pending!.id)).toEqual({ ok: false, code: "not_pending" });
    expect(await acceptAdminInvitations(t.db, password("candidate"))).toEqual({ ok: true, accepted: 0 });

    // A second inviter is suspended before the invitation is accepted.
    await onboard(mfa("master"), "tz-second", "country_super_admin", "tz");
    expect(await inviteAdmin(t.db, mfa("tz-second"), invite)).toMatchObject({ ok: true, outcome: "invited" });
    expect(await setAdminStatus(t.db, mfa("master"), { userId: users["tz-second"]!, status: "suspended", reason: "left the company" })).toEqual({
      ok: true,
      changed: true,
    });
    expect(await acceptAdminInvitations(t.db, password("candidate"))).toEqual({ ok: true, accepted: 0 });
    expect((await getAdminSession(t.db, password("candidate"))).known).toBe(false);
  });

  it("reject malformed input", async () => {
    for (const input of [
      { email: "not-an-email", role: "order_manager", countryId: "tz" },
      { email: "a@example.test", role: "owner", countryId: "tz" },
      { email: "a@example.test", role: "order_manager", countryId: "zz" },
    ]) {
      expect(await inviteAdmin(t.db, mfa("master"), input), JSON.stringify(input)).toEqual({ ok: false, code: "invalid_request" });
    }
  });
});

describe("suspension", () => {
  it("is for a Master Super Admin only, never on themselves or on a Master Super Admin", async () => {
    expect(await setAdminStatus(t.db, mfa("tz-super"), { userId: users["tz-orders"]!, status: "suspended" })).toEqual({ ok: false, code: "not_allowed" });
    expect(await setAdminStatus(t.db, mfa("master"), { userId: users["master"]!, status: "suspended" })).toEqual({ ok: false, code: "own_account" });
    await addUser("second-master");
    await t.db.query(`select app_private.provision_master_super_admin('second-master@example.test')`);
    expect(await setAdminStatus(t.db, mfa("master"), { userId: users["second-master"]!, status: "suspended" })).toEqual({
      ok: false,
      code: "master_is_provisioned",
    });
    await t.db.query(`select app_private.revoke_master_super_admin('second-master@example.test')`);
  });

  it("stops a suspended account at once, with the same session, and reinstating brings it back", async () => {
    const session = mfa("ke-super");
    expect((await listAdminCountries(t.db, session)).map((c) => c.id)).toEqual(["ke"]);

    expect(await setAdminStatus(t.db, mfa("master"), { userId: users["ke-super"]!, status: "suspended", reason: "under review" })).toEqual({
      ok: true,
      changed: true,
    });
    expect(await getAdminSession(t.db, session)).toMatchObject({ known: true, status: "suspended" });
    expect(await listAdminCountries(t.db, session)).toEqual([]);
    expect(await listAdministrators(t.db, session)).toEqual([]);
    expect((await listAuditLog(t.db, session)).total).toBe(0);
    expect(await inviteAdmin(t.db, session, { email: "x@example.test", role: "customer_support", countryId: "ke" })).toEqual({
      ok: false,
      code: "not_allowed",
    });
    expect(await acceptAdminInvitations(t.db, session)).toEqual({ ok: false, code: "not_allowed" });
    // A role cannot be given to a suspended account.
    expect(await inviteAdmin(t.db, mfa("master"), { email: "ke-super@example.test", role: "order_manager", countryId: "ke" })).toEqual({
      ok: false,
      code: "account_suspended",
    });

    expect(await setAdminStatus(t.db, mfa("master"), { userId: users["ke-super"]!, status: "active" })).toEqual({ ok: true, changed: true });
    expect((await listAdminCountries(t.db, session)).map((c) => c.id)).toEqual(["ke"]);
  });
});

describe("countries and services", () => {
  it("lets only a Master Super Admin change a country, and records who tried", async () => {
    expect(await updateCountry(t.db, mfa("tz-super"), "tz", { websiteDomain: "example.test" })).toEqual({ ok: false, code: "not_allowed" });
    expect(await updateCountry(t.db, mfa("ke-super"), "tz", { status: "suspended" })).toEqual({ ok: false, code: "not_allowed" });
    expect((await getAdminCountry(t.db, mfa("master"), "tz"))?.status).toBe("active");
    const events = await listSecurityEvents(t.db, mfa("master"));
    expect(events.some((e) => e.kind === "permission_denied" && e.actorId === users["ke-super"] && e.countryId === "tz")).toBe(true);
  });

  it("keeps Congo unconfirmed until its code, currency and time zone are given", async () => {
    expect(await updateCountry(t.db, mfa("master"), "congo", { status: "active" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await updateCountry(t.db, mfa("master"), "congo", { isoCode: "KE" })).toEqual({ ok: false, code: "already_exists" });
    expect(await updateCountry(t.db, mfa("master"), "congo", { timezone: "Africa/Atlantis" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await updateCountry(t.db, mfa("master"), "congo", { currency: "TOOLONG" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await getAdminCountry(t.db, mfa("master"), "congo")).toMatchObject({ isoCode: null, currency: null, timezone: null, status: "pending_confirmation" });
  });

  it("applies a valid change and writes before and after to the audit log", async () => {
    expect(await updateCountry(t.db, mfa("master"), "ug", { websiteDomain: "Uganda.Example.test" })).toEqual({ ok: true });
    expect((await getAdminCountry(t.db, mfa("master"), "ug"))?.websiteDomain).toBe("uganda.example.test");
    const [entry] = (await listAuditLog(t.db, mfa("master"), { countryId: "ug" })).entries;
    expect(entry).toMatchObject({ action: "country.update", actorEmail: "master@example.test", countryId: "ug" });
    expect(entry!.summary).toMatchObject({ before: { website_domain: null }, after: { website_domain: "uganda.example.test" } });
  });

  it("registers a country service over HTTPS only, and never enables one without an address", async () => {
    expect(await updateCountryService(t.db, mfa("tz-super"), "tz", { enabled: true })).toEqual({ ok: false, code: "not_allowed" });
    expect(await updateCountryService(t.db, mfa("master"), "tz", { enabled: true })).toEqual({ ok: false, code: "invalid_request" });
    expect(await updateCountryService(t.db, mfa("master"), "tz", { apiBaseUrl: "http://tz.example.test" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await updateCountryService(t.db, mfa("master"), "tz", { apiBaseUrl: "https://tz.example.test/internal" })).toEqual({ ok: true });
    const [service] = await listCountryServices(t.db, mfa("tz-super"));
    expect(service).toMatchObject({ countryId: "tz", apiBaseUrl: "https://tz.example.test/internal", enabled: false, lastCheck: null });
  });

  it("records a health check only for someone who may see the country's settings", async () => {
    const check = { ok: false, statusCode: 404, latencyMs: 120, errorCode: "not_found" };
    expect(await recordCountryHealthCheck(t.db, mfa("ke-super"), "tz", check)).toEqual({ ok: false, code: "not_allowed" });
    expect(await recordCountryHealthCheck(t.db, password("tz-orders"), "tz", check)).toEqual({ ok: false, code: "not_allowed" });
    expect(await recordCountryHealthCheck(t.db, mfa("tz-super"), "tz", check)).toEqual({ ok: true });
    const [service] = await listCountryServices(t.db, mfa("tz-super"));
    expect(service?.lastCheck).toMatchObject({ ok: false, statusCode: 404, latencyMs: 120, errorCode: "not_found" });
  });
});

describe("audit log", () => {
  it("records role changes with the actor, the country and the target", async () => {
    const audit = await listAuditLog(t.db, mfa("master"), { countryId: "tz" });
    const grant = audit.entries.find((e) => e.action === "invitation.accept" && e.targetId === users["tz-orders"]);
    expect(grant).toMatchObject({ countryId: "tz", targetType: "admin", actorEmail: "tz-orders@example.test" });
    expect(grant!.summary).toMatchObject({ role: "order_manager", invited_by: users["tz-super"] });
    const suspended = (await listAuditLog(t.db, mfa("master"), { countryId: "global" })).entries.find((e) => e.action === "admin.suspend");
    expect(suspended).toMatchObject({ countryId: null, actorEmail: "master@example.test" });
  });

  it("cannot be changed or emptied, not even by the database owner", async () => {
    expect(await failure(() => t.db.query(`update audit_logs set action = 'x.y'`))).toMatch(/append-only/);
    expect(await failure(() => t.db.query(`delete from audit_logs`))).toMatch(/append-only/);
    expect(await failure(() => t.db.query(`truncate audit_logs`))).toMatch(/append-only/);
  });

  it("pages through entries, newest first", async () => {
    const first = await listAuditLog(t.db, mfa("master"));
    expect(first.page).toBe(1);
    expect(first.entries.length).toBeLessThanOrEqual(first.pageSize);
    expect(first.total).toBeGreaterThanOrEqual(first.entries.length);
    const times = first.entries.map((e) => e.occurredAt);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe("security events and overview", () => {
  it("are recorded for any signed-in user but readable by a Master Super Admin only", async () => {
    await recordSecurityEvent(t.db, password("stranger"), { kind: "country_denied", countryId: "tz", detail: { path: "/c/tz/orders" } });
    await recordSecurityEvent(t.db, password("stranger"), { kind: "permission_denied", detail: { blob: "x".repeat(5000) } });
    const events = await listSecurityEvents(t.db, mfa("master"));
    const fromStranger = events.filter((e) => e.actorId === users["stranger"]);
    expect(fromStranger.map((e) => e.kind)).toEqual(["country_denied"]);
    expect(await listSecurityEvents(t.db, mfa("tz-super"))).toEqual([]);
    expect(await listSecurityEvents(t.db, password("stranger"))).toEqual([]);
  });

  it("counts only what the caller may see", async () => {
    const all = await getAdminOverview(t.db, mfa("master"));
    expect(all.countries).toBe(5);
    expect(all.activeCountries).toBe(1);
    const tz = await getAdminOverview(t.db, mfa("tz-super"));
    expect(tz.countries).toBe(1);
    expect(tz.administrators).toBeLessThan(all.administrators);
    expect(await getAdminOverview(t.db, password("stranger"))).toMatchObject({ countries: 0, administrators: 0, pendingInvitations: 0 });
  });
});

describe("reaching a country and auditing what was done there (0002)", () => {
  it("gives a country's service address to anyone with a role there, and to nobody else", async () => {
    expect(await getCountryEndpoint(t.db, password("tz-orders"), "tz")).toMatchObject({ countryId: "tz", isoCode: "TZ", apiBaseUrl: "https://tz.example.test/internal", enabled: false });
    expect(await getCountryEndpoint(t.db, mfa("master"), "congo")).toMatchObject({ countryId: "congo", isoCode: null, apiBaseUrl: null, enabled: false });
    expect(await getCountryEndpoint(t.db, mfa("ke-super"), "tz")).toBeNull();
    expect(await getCountryEndpoint(t.db, password("stranger"), "tz")).toBeNull();
    // A super admin who has not passed the second factor counts as nobody.
    expect(await getCountryEndpoint(t.db, password("tz-super"), "tz")).toBeNull();
  });

  it("records an order change for someone who may change orders in that country, and refuses everyone else", async () => {
    const entry = { action: "order.status_change" as const, targetId: "TZ-261116-ABCDEF12", summary: { from: "confirmed", to: "processing" } };
    expect(await recordCountryAction(t.db, password("tz-orders"), { countryId: "tz", ...entry })).toEqual({ ok: true });
    // Customer Support reads orders but may not change them.
    expect(await recordCountryAction(t.db, password("ke-support"), { countryId: "ke", ...entry })).toEqual({ ok: false, code: "not_allowed" });
    // An Order Manager of Tanzania has no say in Kenya.
    expect(await recordCountryAction(t.db, password("tz-orders"), { countryId: "ke", ...entry })).toEqual({ ok: false, code: "not_allowed" });
    expect(await recordCountryAction(t.db, password("stranger"), { countryId: "tz", ...entry })).toEqual({ ok: false, code: "not_allowed" });

    const [logged] = (await listAuditLog(t.db, mfa("master"), { countryId: "tz" })).entries;
    expect(logged).toMatchObject({ action: "order.status_change", actorEmail: "tz-orders@example.test", countryId: "tz", targetType: "order", targetId: "TZ-261116-ABCDEF12" });
    expect(logged!.summary).toEqual({ from: "confirmed", to: "processing" });
    const refused = await listSecurityEvents(t.db, mfa("master"));
    expect(refused.some((event) => event.kind === "permission_denied" && event.actorId === users["tz-orders"] && event.countryId === "ke")).toBe(true);
  });

  it("accepts only the actions it knows, with a bounded target and summary", async () => {
    const base = { countryId: "tz", targetId: "TZ-261116-ABCDEF12", summary: {} };
    // @ts-expect-error an action this console cannot carry out
    expect(await recordCountryAction(t.db, mfa("master"), { ...base, action: "order.delete" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await recordCountryAction(t.db, mfa("master"), { ...base, action: "order.note_add", targetId: "" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await recordCountryAction(t.db, mfa("master"), { ...base, action: "order.note_add", summary: { blob: "x".repeat(4000) } })).toEqual({ ok: false, code: "invalid_request" });
    expect(await recordCountryAction(t.db, mfa("master"), { ...base, action: "order.note_add" })).toEqual({ ok: true });
  });
});
