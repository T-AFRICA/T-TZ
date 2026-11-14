import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withAccess, type Access } from "../src/db";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Migration 0005 on a disposable PGlite database with a stand-in for the
 * Supabase Storage tables (testing/supabase-shim.ts): who may create, read,
 * replace and delete a profile photo. Every statement runs as the role the
 * storefront uses, so Row Level Security decides.
 */
let t: TestDatabase;
let alice: Access & { userId: string };
let bob: Access & { userId: string };
const anon: Access = { role: "anon" };

const insert = (access: Access, name: string, bucket = "avatars") =>
  withAccess(t.db, access, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]));
const names = (access: Access) =>
  withAccess(t.db, access, async (tx) => (await tx.query<{ name: string }>(`select name from storage.objects order by name`)).map((row) => row.name));
const ownerCount = async (name: string) =>
  (await t.db.query<{ n: number }>(`select count(*)::int as n from storage.objects where bucket_id = 'avatars' and name = $1`, [name]))[0]?.n;

beforeAll(async () => {
  t = await createTestDatabase({ seed: false });
  alice = { role: "authenticated", userId: await createAuthUser(t.db, "alice@example.test") };
  bob = { role: "authenticated", userId: await createAuthUser(t.db, "bob@example.test") };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("avatars bucket", () => {
  it("is private, limited to 2 MB and to JPEG, PNG and WebP", async () => {
    const [bucket] = await t.db.query<{ public: boolean; file_size_limit: string | number; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`,
    );
    expect(bucket?.public).toBe(false);
    expect(Number(bucket?.file_size_limit)).toBe(2 * 1024 * 1024);
    expect(bucket?.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("lets a customer create and read only their own photo", async () => {
    await insert(alice, `${alice.userId}/avatar`);
    expect(await names(alice)).toEqual([`${alice.userId}/avatar`]);
    expect(await names(bob)).toEqual([]);
    expect(await names(anon)).toEqual([]);
  });

  it("refuses another customer's path, any other object name and signed-out visitors", async () => {
    await expect(insert(bob, `${alice.userId}/avatar`)).rejects.toThrow(/row-level security|duplicate key/);
    await expect(insert(bob, `${alice.userId}/second`)).rejects.toThrow(/row-level security/);
    await expect(insert(alice, `${alice.userId}/second.png`)).rejects.toThrow(/row-level security/);
    await expect(insert(alice, `${alice.userId}/avatar/extra`)).rejects.toThrow(/row-level security/);
    await expect(insert(anon, "anon/avatar")).rejects.toThrow(/row-level security/);
    // The policies cover this bucket only: nothing is opened elsewhere.
    await t.db.query(`insert into storage.buckets (id, name) values ('other', 'other')`);
    await expect(insert(alice, `${alice.userId}/avatar`, "other")).rejects.toThrow(/row-level security/);
  });

  it("lets nobody else replace or delete a photo, and the owner do both", async () => {
    const path = `${alice.userId}/avatar`;
    await withAccess(t.db, bob, (tx) => tx.query(`update storage.objects set owner = $1 where name = $2`, [bob.userId, path]));
    await withAccess(t.db, bob, (tx) => tx.query(`delete from storage.objects where name = $1`, [path]));
    await withAccess(t.db, anon, (tx) => tx.query(`delete from storage.objects where name = $1`, [path]));
    expect(await ownerCount(path)).toBe(1);
    const [row] = await t.db.query<{ owner: string | null }>(`select owner from storage.objects where name = $1`, [path]);
    expect(row?.owner).toBeNull();

    // The owner cannot move the photo to another customer's path either.
    await expect(
      withAccess(t.db, alice, (tx) => tx.query(`update storage.objects set name = $1 where name = $2`, [`${bob.userId}/avatar`, path])),
    ).rejects.toThrow(/row-level security/);

    await withAccess(t.db, alice, (tx) => tx.query(`update storage.objects set owner = $1 where name = $2`, [alice.userId, path]));
    await withAccess(t.db, alice, (tx) => tx.query(`delete from storage.objects where name = $1`, [path]));
    expect(await ownerCount(path)).toBe(0);
  });
});
