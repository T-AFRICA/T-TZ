import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KeyFormatError, createCountryAdminApi, createServiceTokenSigner, createServiceTokenVerifier, normalizePem } from "./index";

/**
 * Keys as they arrive from a hosting dashboard. The pair is made up for the
 * run and never leaves memory.
 */
let privatePem: string;
let publicPem: string;

const body = (pem: string) => pem.replace(/-----(BEGIN|END) [A-Z ]+-----/g, "").replace(/\s+/g, "");
const request = { countryCode: "TZ", actorId: "5b1f6c5e-3d0a-4a59-9a43-0d2f3f6f1c11", permission: "settings.read", method: "GET", path: "/api/admin/v1/health", body: "" };

async function failure(fn: () => Promise<unknown> | unknown): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
}

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privatePem = await exportPKCS8(pair.privateKey);
  publicPem = await exportSPKI(pair.publicKey);
});

describe("keys pasted in different shapes", () => {
  it("are all the same key: escaped line breaks, quotes, one line, Windows line endings, only the middle part", async () => {
    const shapes = (pem: string) => [
      pem,
      pem.replace(/\n/g, "\\n"),
      `"${pem.replace(/\n/g, "\\n")}"`,
      `  '${pem}'  `,
      pem.replace(/\n/g, " "),
      pem.replace(/\n/g, "\r\n"),
      body(pem),
      `-----BEGIN ${pem.includes("PRIVATE") ? "PRIVATE" : "PUBLIC"} KEY-----\n${body(pem)}`,
    ];
    for (const [index, privateShape] of shapes(privatePem).entries()) {
      const publicShape = shapes(publicPem)[index] as string;
      const signer = await createServiceTokenSigner({ privateKeyPem: privateShape, keyId: "k1" });
      const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: publicShape } });
      const token = await signer.sign(request);
      const verified = await verifier.verify({ authorization: `Bearer ${token}`, requiredPermission: "settings.read", method: "GET", path: request.path, body: "" });
      expect(verified.ok, `shape ${index}`).toBe(true);
    }
    expect(normalizePem(body(publicPem), "PUBLIC KEY")).toBe(normalizePem(publicPem, "PUBLIC KEY"));
  });

  it("are refused with the reason when the two halves are swapped", async () => {
    const asVerifier = await failure(() => createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: privatePem } }));
    expect(asVerifier).toBeInstanceOf(KeyFormatError);
    expect(asVerifier).toMatchObject({ reason: "wrong_kind", expected: "PUBLIC KEY" });
    const asSigner = await failure(() => createServiceTokenSigner({ privateKeyPem: publicPem, keyId: "k1" }));
    expect(asSigner).toMatchObject({ reason: "wrong_kind", expected: "PRIVATE KEY" });
    // Without its BEGIN line the other half cannot be told apart by name, but it still cannot be read.
    expect(await failure(() => createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: body(privatePem) } }))).toMatchObject({ reason: "unreadable" });
  });

  it("are refused with the reason when empty or not a key, and the message never repeats the value", async () => {
    expect(await failure(() => normalizePem("", "PUBLIC KEY"))).toMatchObject({ reason: "empty" });
    expect(await failure(() => normalizePem('""', "PUBLIC KEY"))).toMatchObject({ reason: "empty" });
    expect(await failure(() => normalizePem(undefined, "PRIVATE KEY"))).toMatchObject({ reason: "empty" });
    for (const junk of ["CENTRAL_ADMIN_VERIFY_KEY.pem", "C:\\Users\\someone\\keys\\public.pem", "2026-11", "not a key at all, just words", `${body(publicPem).slice(0, 40)}`]) {
      const error = (await failure(() => createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: junk } }))) as KeyFormatError;
      expect(error, junk).toBeInstanceOf(KeyFormatError);
      expect(error.reason, junk).toBe("unreadable");
      expect(error.message.includes(junk), junk).toBe(false);
    }
    // An older key format with another label is not silently accepted.
    expect(await failure(() => normalizePem(`-----BEGIN EC PRIVATE KEY-----\n${body(privatePem)}\n-----END EC PRIVATE KEY-----`, "PRIVATE KEY"))).toMatchObject({
      reason: "wrong_kind",
    });
    expect(await failure(() => normalizePem(`-----BEGIN CERTIFICATE-----\n${body(publicPem)}\n-----END CERTIFICATE-----`, "PUBLIC KEY"))).toMatchObject({
      reason: "unreadable",
    });
  });
});

describe("a country that cannot read its copy of the public key", () => {
  let server: Server;
  let baseUrl: string;
  let answer: { status: number; body: string };

  beforeAll(async () => {
    server = createServer((_request, response) => response.writeHead(answer.status, { "content-type": "application/json" }).end(answer.body));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("is reported to the admin as that, and other 503 answers as a server error", async () => {
    const signer = await createServiceTokenSigner({ privateKeyPem: privatePem, keyId: "k1" });
    const api = createCountryAdminApi({ baseUrl, countryCode: "TZ", signer, allowInsecureLoopback: true, timeoutMs: 1000 });
    answer = { status: 503, body: JSON.stringify({ ok: false, code: "verify_key_wrong_kind" }) };
    expect(await api.health(request.actorId)).toMatchObject({ available: false, reason: "country_key_invalid", statusCode: 503 });
    answer = { status: 503, body: JSON.stringify({ ok: false, code: "orders_not_connected" }) };
    expect(await api.listOrders(request.actorId)).toMatchObject({ available: false, reason: "server_error", statusCode: 503 });
    answer = { status: 503, body: "<html>maintenance</html>" };
    expect(await api.health(request.actorId)).toMatchObject({ available: false, reason: "server_error", statusCode: 503 });
  });
});
