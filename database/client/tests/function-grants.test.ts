import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Who may run what in the country database once every migration is applied.
 *
 * The anon key is public and Supabase serves every function of the public
 * schema to it over HTTP, so a function that anon or a signed-in customer
 * can run is part of the site's public surface. This is the whole list. A
 * new function that should be public is added here on purpose; one that is
 * open by accident (a missing "revoke ... from public") fails this test.
 */
const FOR_EVERYONE = [
  "customer_order_tracking",
  "public_category_banner",
  "public_category_tree",
  "public_product_image",
  "search_compact",
  "search_products",
  "track_order",
];

const FOR_SIGNED_IN_CUSTOMERS = [
  ...FOR_EVERYONE,
  "customer_claim_guest_orders",
  "customer_delivery_code",
  "customer_set_delivery_point",
  "place_cod_order",
].sort();

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase({ seed: false });
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

/** Functions of the public schema that `role` may run, leaving out those an extension installed. */
async function runnableBy(role: string): Promise<string[]> {
  const rows = await t.db.query<{ name: string }>(
    `select distinct p.proname as name
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege($1, p.oid, 'execute')
      order by 1`,
    [role],
  );
  return rows.map((row) => row.name);
}

describe("functions the public can reach", () => {
  it("a visitor can run only the functions meant for everyone", async () => {
    expect(await runnableBy("anon")).toEqual(FOR_EVERYONE);
  });

  it("a signed-in customer can run those and the customer functions, and no administrative one", async () => {
    const names = await runnableBy("authenticated");
    expect(names).toEqual(FOR_SIGNED_IN_CUSTOMERS);
    expect(names.filter((name) => /^(admin_|rider_|payment_|report_)/.test(name))).toEqual([]);
  });

  it("a function added later is closed until it is granted (migration 0020)", async () => {
    await t.pg.exec(`create function zz_new_function() returns int language sql as 'select 1'`);
    const [row] = await t.db.query<{ anon: boolean; customer: boolean; service: boolean }>(
      `select has_function_privilege('anon', 'zz_new_function()', 'execute') as anon,
              has_function_privilege('authenticated', 'zz_new_function()', 'execute') as customer,
              has_function_privilege('service_role', 'zz_new_function()', 'execute') as service`,
    );
    expect(row).toMatchObject({ anon: false, customer: false });
    await t.pg.exec(`drop function zz_new_function()`);
  });

  it("every function that runs with its owner's rights pins its search path", async () => {
    const rows = await t.db.query<{ name: string }>(
      `select p.proname as name
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as setting where setting like 'search_path=%')`,
    );
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("every table of the public schema has row level security on", async () => {
    const rows = await t.db.query<{ name: string }>(
      `select c.relname as name
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        order by 1`,
    );
    expect(rows.map((row) => row.name)).toEqual([]);
  });
});
