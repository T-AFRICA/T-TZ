import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  categoryTreeResponseSchema,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  type CategoryTree,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { loadPublicProducts } from "../src/catalog";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { createTestDatabase, migrationsDir, type TestDatabase } from "../src/testing";

/**
 * Categories and brands (migration 0018) through the country admin API, on a
 * disposable PGlite database with the SAMPLE catalogue: the storefront's list
 * written into the database, changes from the admin, banners, and what
 * visitors may read.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;

const EDITOR = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 5)]);

async function send(method: "GET" | "POST", path: string, permission: string, body?: unknown): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId: EDITOR, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

const tree = async (): Promise<CategoryTree> => categoryTreeResponseSchema.parse((await send("GET", "/categories", "categories.manage")).body);
const save = async (body: unknown) => (await send("POST", "/categories/save", "categories.manage", body)).body as Record<string, unknown>;
const publicTree = async () =>
  ((await withAccess(t.db, ANON, (tx) => tx.query<{ tree: unknown }>(`select public_category_tree() as tree`)))[0]!.tree as {
    slug: string;
    name: string;
    banner: string | null;
    groups: { slug: string; name: string; subcategories: { slug: string }[] }[];
  }[]);

beforeAll(async () => {
  t = await createTestDatabase();
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("the storefront's list, in the database", () => {
  it("has every department, group and subcategory with the website's names and order; Shop by Use stays the website's own", async () => {
    const departments = CATEGORY_SECTIONS.filter((section) => (section.kind ?? "department") === "department");
    const visible = await publicTree();
    expect(visible.map((c) => [c.slug, c.name])).toEqual(departments.map((d) => [d.slug, d.name]));
    for (const department of departments) {
      const found = visible.find((c) => c.slug === department.slug)!;
      expect(found.groups.map((g) => [g.slug, g.name]), department.slug).toEqual(department.groups.map((g) => [g.slug, g.name]));
      for (const group of department.groups) {
        expect(found.groups.find((g) => g.slug === group.slug)!.subcategories.map((s) => s.slug)).toEqual((group.subcategories ?? []).map((s) => s.slug));
      }
    }
    expect(visible.map((c) => c.slug)).not.toContain("shop-by-use");
  });

  it("running the migration again keeps what an administrator changed", async () => {
    const lighting = (await tree()).categories.find((c) => c.slug === "lighting")!;
    expect(await save({ level: "category", id: lighting.id, name: "Lights & Lamps", description: "Every light we sell", sortOrder: lighting.sortOrder, active: true })).toMatchObject({ ok: true });
    await t.pg.exec(readFileSync(join(migrationsDir(), "0018_category_admin.sql"), "utf8"));
    const again = (await tree()).categories.find((c) => c.slug === "lighting")!;
    expect(again).toMatchObject({ id: lighting.id, name: "Lights & Lamps", description: "Every light we sell" });
    // Products keep their category, and the storefront's view shows the new name.
    expect((await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === "sample-led-panel")?.categoryName).toBe("Lights & Lamps");
  });
});

describe("who may change categories", () => {
  it("customers and visitors only read the active tree and banners; the admin functions need categories.manage", async () => {
    for (const role of ["anon", "authenticated"]) {
      const callable = await t.db.query<{ proname: string }>(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname in ('admin_category_tree', 'admin_save_taxonomy', 'admin_save_brand', 'admin_set_category_banner',
                                                       'admin_get_category_banner', 'taxonomy_uuid', 'public_category_tree', 'public_category_banner')
            and has_function_privilege($1, p.oid, 'execute') order by 1`,
        [role],
      );
      expect(callable.map((row) => row.proname), role).toEqual(["public_category_banner", "public_category_tree"]);
      expect(await t.db.query(`select 1 from pg_class c where c.relname = 'category_banners' and has_table_privilege($1, c.oid, 'select')`, [role])).toEqual([]);
    }
    expect(await send("POST", "/categories/save", "products.update", { level: "category", slug: "x-y", name: "X Y", description: null, sortOrder: 1, active: true })).toMatchObject({
      status: 401,
      body: { code: "wrong_permission" },
    });
  });
});

describe("changing the tree", () => {
  it("creates a category with a group and a subcategory, renames, reorders and hides; the web address never changes", async () => {
    const created = await save({ level: "category", slug: "solar-energy", name: "Solar Energy", description: "Panels, batteries and inverters", sortOrder: 70, active: true });
    expect(created).toMatchObject({ ok: true, replayed: false, slug: "solar-energy" });
    const group = await save({ level: "group", parentId: created.id, slug: "solar-panels", name: "Solar Panels", description: null, sortOrder: 0, active: true });
    expect(group).toMatchObject({ ok: true, slug: "solar-panels" });
    const sub = await save({ level: "subcategory", parentId: group.id, slug: "mono-panels", name: "Mono Panels", description: null, sortOrder: 0, active: true });
    expect(sub).toMatchObject({ ok: true, slug: "mono-panels" });

    let solar = (await publicTree()).find((c) => c.slug === "solar-energy")!;
    expect(solar).toMatchObject({ name: "Solar Energy", groups: [{ slug: "solar-panels", subcategories: [{ slug: "mono-panels" }] }] });
    // The same address again, Shop by Use, and a sibling with the same address are refused.
    expect(await save({ level: "category", slug: "solar-energy", name: "Solar Two", description: null, sortOrder: 1, active: true })).toEqual({ ok: false, code: "slug_taken" });
    expect(await save({ level: "category", slug: "shop-by-use", name: "Use", description: null, sortOrder: 1, active: true })).toEqual({ ok: false, code: "slug_taken" });
    expect(await save({ level: "group", parentId: created.id, slug: "solar-panels", name: "Again", description: null, sortOrder: 1, active: true })).toEqual({
      ok: false,
      code: "slug_taken",
    });
    // A description belongs to categories only; a new one needs its parent.
    expect(await save({ level: "group", parentId: created.id, slug: "x-z", name: "X Z", description: "No", sortOrder: 1, active: true })).toEqual({ ok: false, code: "invalid_request" });
    expect(await save({ level: "subcategory", slug: "orphan", name: "Orphan", description: null, sortOrder: 1, active: true })).toEqual({ ok: false, code: "invalid_request" });

    // Rename and hide the subcategory; the address stays.
    expect(await save({ level: "subcategory", id: sub.id, name: "Monocrystalline Panels", description: null, sortOrder: 3, active: false })).toMatchObject({ ok: true, slug: "mono-panels" });
    solar = (await publicTree()).find((c) => c.slug === "solar-energy")!;
    expect(solar.groups[0]!.subcategories).toEqual([]);
    const admin = (await tree()).categories.find((c) => c.slug === "solar-energy")!;
    expect(admin.groups[0]!.subcategories[0]).toMatchObject({ name: "Monocrystalline Panels", sortOrder: 3, active: false });
    expect(await save({ level: "group", id: "00000000-0000-4000-8000-000000000000", name: "Gone", description: null, sortOrder: 1, active: true })).toEqual({ ok: false, code: "not_found" });
  });

  it("hiding a category takes its products off the storefront; showing it brings them back", async () => {
    const cables = (await tree()).categories.find((c) => c.slug === "cables-wiring")!;
    expect(cables.live).toBeGreaterThan(0);
    const before = (await loadPublicProducts(t.db, "TZ")).filter((p) => p.categorySlug === "cables-wiring").length;
    expect(before).toBe(cables.live);
    await save({ level: "category", id: cables.id, name: cables.name, description: cables.description, sortOrder: cables.sortOrder, active: false });
    expect((await loadPublicProducts(t.db, "TZ")).filter((p) => p.categorySlug === "cables-wiring")).toEqual([]);
    expect((await publicTree()).map((c) => c.slug)).not.toContain("cables-wiring");
    await save({ level: "category", id: cables.id, name: cables.name, description: cables.description, sortOrder: cables.sortOrder, active: true });
    expect((await loadPublicProducts(t.db, "TZ")).filter((p) => p.categorySlug === "cables-wiring")).toHaveLength(before);
  });

  it("the same signed request changes the tree once", async () => {
    const path = `${COUNTRY_ADMIN_API_PREFIX}/categories/save`;
    const text = JSON.stringify({ level: "category", slug: "smart-home", name: "Smart Home", description: null, sortOrder: 80, active: false });
    const token = await signer.sign({ countryCode: "TZ", actorId: EDITOR, permission: "categories.manage", method: "POST", path, body: text });
    const request = { method: "POST", path, authorization: `Bearer ${token}`, body: text };
    const first = (await handleCountryAdminRequest(service, request)).body as Record<string, unknown>;
    expect(first).toMatchObject({ ok: true, replayed: false, slug: "smart-home" });
    expect((await handleCountryAdminRequest(service, request)).body).toEqual({ ok: true, replayed: true, id: first.id, slug: "smart-home" });
    expect((await tree()).categories.filter((c) => c.slug === "smart-home")).toHaveLength(1);
  });
});

describe("brands", () => {
  it("are created and renamed, each name once; the storefront shows the new name", async () => {
    const created = (await send("POST", "/brands/save", "categories.manage", { name: "SunVolt" })).body as Record<string, unknown>;
    expect(created).toMatchObject({ ok: true, replayed: false });
    expect((await send("POST", "/brands/save", "categories.manage", { name: "sunvolt" })).body).toEqual({ ok: false, code: "name_taken" });
    const brands = (await tree()).brands;
    expect(brands.find((b) => b.name === "SunVolt")).toMatchObject({ slug: "sunvolt", products: 0 });

    const panelBrand = (await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === "sample-led-panel")?.brand;
    const used = brands.find((b) => b.name === panelBrand);
    if (used) {
      expect((await send("POST", "/brands/save", "categories.manage", { id: used.id, name: `${used.name} Pro` })).body).toMatchObject({ ok: true, id: used.id });
      expect((await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === "sample-led-panel")?.brand).toBe(`${used.name} Pro`);
    }
  });
});

describe("banners", () => {
  it("are set, read by administrators, served to visitors only while the category is shown, and removed", async () => {
    const tools = (await tree()).categories.find((c) => c.slug === "tools")!;
    expect((await send("POST", `/categories/${tools.id}/banner`, "categories.manage", { contentType: "image/jpeg", data: PNG.toString("base64") })).body).toEqual({
      ok: false,
      code: "invalid_request",
    });
    expect((await send("POST", `/categories/${tools.id}/banner`, "categories.manage", { contentType: "image/png", data: PNG.toString("base64") })).body).toMatchObject({ ok: true });
    expect((await send("GET", `/categories/${tools.id}/banner`, "categories.manage")).body).toEqual({ ok: true, file: { contentType: "image/png", data: PNG.toString("base64") } });
    const served = async () => withAccess(t.db, ANON, (tx) => tx.query<{ content_type: string; bytes: Uint8Array }>(`select * from public_category_banner('tools')`));
    expect((await served())[0]?.content_type).toBe("image/png");
    expect((await publicTree()).find((c) => c.slug === "tools")!.banner).toMatch(/^[0-9a-f]{16}$/);

    await save({ level: "category", id: tools.id, name: tools.name, description: tools.description, sortOrder: tools.sortOrder, active: false });
    expect(await served()).toEqual([]);
    await save({ level: "category", id: tools.id, name: tools.name, description: tools.description, sortOrder: tools.sortOrder, active: true });

    expect((await send("POST", `/categories/${tools.id}/banner`, "categories.manage", { remove: true })).body).toMatchObject({ ok: true });
    expect(await served()).toEqual([]);
    expect((await tree()).categories.find((c) => c.slug === "tools")!.banner).toBeNull();
  });
});
