import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:https";
import { createMemoryReplayGuard, createServiceTokenVerifier } from "@tronic/api-contracts";
import { placeCodOrder, type Db } from "@tronic/database";
import { handleCountryAdminRequest } from "@tronic/database/country-admin";
import { createShopper, createTestDatabase } from "@tronic/database/testing";

/**
 * TEST ONLY: a stand-in for Tanzania's backend, for the admin browser tests
 * and the local preview. It is not a copy of the storefront: it serves the
 * country admin API with the very function the storefront serves it with
 * (handleCountryAdminRequest), in front of a disposable country database
 * with every country migration and the sample catalogue, over HTTPS with a
 * certificate made up for the run. So the requests the admin signs are
 * verified for real, and the order rules are the database's own.
 *
 * The orders in it are synthetic (example.test addresses, sample prices).
 */

export interface CountryStandIn {
  db: Db;
  /** The synthetic orders, oldest first. */
  orderNumbers: string[];
  stop: () => Promise<void>;
}

interface SampleLine {
  product: string;
  quantity: number;
  color?: string;
  variant?: string;
}

const CUSTOMERS: { name: string; email: string; phone: string; region: string; lines: SampleLine[] }[] = [
  { name: "Asha Mrema", email: "asha@example.test", phone: "+255712000001", region: "Dar es Salaam", lines: [{ product: "sample-led-panel", quantity: 2 }] },
  { name: "Baraka Juma", email: "baraka@example.test", phone: "+255712000002", region: "Arusha", lines: [{ product: "sample-top-plug", quantity: 3 }] },
  {
    name: "Neema Kessy",
    email: "neema@example.test",
    phone: "+255712000003",
    region: "Mwanza",
    lines: [
      { product: "sample-led-panel", quantity: 1 },
      { product: "sample-top-plug", quantity: 1 },
    ],
  },
  { name: "Juma Said", email: "juma@example.test", phone: "+255712000004", region: "Dodoma", lines: [{ product: "sample-extension", quantity: 1, color: "White", variant: "4-way" }] },
];

export async function startCountryStandIn(options: {
  port: number;
  tls: { cert: string; key: string };
  /** The Central Admin's public key (SPKI PEM) and the name it signs with. */
  verifyKey: { pem: string; keyId: string };
}): Promise<CountryStandIn> {
  const { pg, db } = await createTestDatabase();

  const orderNumbers: string[] = [];
  for (const customer of CUSTOMERS) {
    // Orders need an account (migration 0015): each sample customer is registered.
    const placed = await placeCodOrder(db, await createShopper(db, customer.email), {
      idempotencyKey: randomUUID(),
      country: "TZ",
      contact: { name: customer.name, email: customer.email, phone: customer.phone },
      delivery: { method: "home", region: customer.region, district: "Central", ward: "Sample ward", street: "12 Sample Road", extra: "", notes: "" },
      lines: customer.lines.map((line) => ({ product: line.product, color: line.color ?? null, variant: line.variant ?? null, quantity: line.quantity })),
      expectedTotalMinor: null,
    });
    if (!placed.ok) throw new Error(`country stand-in: could not place a sample order: ${placed.code}`);
    orderNumbers.push(placed.orderNumber);
  }

  const verifier = await createServiceTokenVerifier({
    countryCode: "TZ",
    publicKeysPem: { [options.verifyKey.keyId]: options.verifyKey.pem },
    seenBefore: createMemoryReplayGuard(),
  });
  const service = { countryCode: "TZ", verifier, db };

  const server: Server = createServer({ cert: options.tls.cert, key: options.tls.key }, (request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void handleCountryAdminRequest(service, {
        method: request.method ?? "GET",
        path: request.url ?? "/",
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
      })
        .then((answer) => {
          response.writeHead(answer.status, { "content-type": "application/json", "cache-control": "no-store", connection: "close" }).end(JSON.stringify(answer.body));
        })
        .catch(() => {
          response.writeHead(500, { "content-type": "application/json", connection: "close" }).end(JSON.stringify({ ok: false, code: "server_error" }));
        });
    });
  });
  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve));

  return {
    db,
    orderNumbers,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pg.close();
    },
  };
}
