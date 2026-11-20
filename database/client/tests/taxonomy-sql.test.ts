import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { TAXONOMY_BEGIN, TAXONOMY_END, buildTaxonomyRows } from "../scripts/taxonomy-sql";
import { migrationsDir } from "../src/testing";

/**
 * Migration 0018 fills the database with the storefront's category list.
 * Its rows are generated from packages/country-config; this fails when the
 * migration and the list drift apart. To refresh the block, run
 * PRINT_TAXONOMY=1 pnpm --filter @tronic/database exec vitest run tests/taxonomy-sql.test.ts
 * and paste what it prints between the markers.
 */
describe("the category list in migration 0018", () => {
  it("is the storefront's list, row for row", () => {
    const expected = buildTaxonomyRows(CATEGORY_SECTIONS);
    if (process.env.PRINT_TAXONOMY) console.log(`\n${expected}\n`);
    const migration = readFileSync(join(migrationsDir(), "0018_category_admin.sql"), "utf8").replaceAll("\r\n", "\n");
    const start = migration.indexOf(TAXONOMY_BEGIN);
    const end = migration.indexOf(TAXONOMY_END);
    expect(start, "BEGIN marker").toBeGreaterThan(-1);
    expect(migration.slice(start, end + TAXONOMY_END.length)).toBe(expected);
  });
});
