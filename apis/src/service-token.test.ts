import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT, importPKCS8 } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_ENDPOINTS,
  createCountryAdminApi,
  createMemoryReplayGuard,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  unavailableCountryApi,
  type ServiceTokenSigner,
  type ServiceTokenVerifier,
} from "./index";

/**
 * Key pairs are generated here for the test run and never leave memory.
 * No real key is in the repository.
 */
let adminPrivate: string;
let adminPublic: string;
let otherPrivate: string;
let signer: ServiceTokenSigner;
let tanzania: ServiceTokenVerifier;
let kenya: ServiceTokenVerifier;

const ACTOR = "5b1f6c5e-3d0a-4a59-9a43-0d2f3f6f1c11";
const request = { method: "GET", path: "/api/admin/v1/health", body: "" };

beforeAll(async () => {
  const admin = await generateKeyPair("ES256", { extractable: true });
  adminPrivate = await exportPKCS8(admin.privateKey);
  adminPublic = await exportSPKI(admin.publicKey);
  otherPrivate = await exportPKCS8((await generateKeyPair("ES256", { extractable: true })).privateKey);
  signer = await createServiceTokenSigner({ privateKeyPem: adminPrivate, keyId: "k1" });
  tanzania = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: adminPublic } });
  kenya = await createServiceTokenVerifier({ countryCode: "KE", publicKeysPem: { k1: adminPublic } });
});

const bearer = (token: string) => `Bearer ${token}`;
const sign = (overrides: Partial<Parameters<ServiceTokenSigner["sign"]>[0]> = {}) =>
  signer.sign({ countryCode: "TZ", actorId: ACTOR, permission: "settings.read", ...request, ...overrides });
const verify = (verifier: ServiceTokenVerifier, token: string, overrides: Partial<typeof request & { requiredPermission: string }> = {}) =>
  verifier.verify({ authorization: bearer(token), requiredPermission: "settings.read", ...request, ...overrides });

describe("signed service requests", () => {
  it("are accepted by the country they were signed for, with the actor and permission", async () => {
    const result = await verify(tanzania, await sign());
    expect(result).toMatchObject({ ok: true, actorId: ACTOR, permission: "settings.read", countryCode: "TZ" });
  });

  it("are refused by any other country", async () => {
    expect(await verify(kenya, await sign())).toEqual({ ok: false, reason: "wrong_country" });
  });

  it("are refused for an endpoint that needs another permission", async () => {
    expect(await verify(tanzania, await sign(), { requiredPermission: "orders.update" })).toEqual({ ok: false, reason: "wrong_permission" });
    expect(await verify(tanzania, await sign({ permission: "orders.read" }))).toEqual({ ok: false, reason: "wrong_permission" });
  });

  it("are refused when the method, path, query or body is not the one that was signed", async () => {
    const token = await sign();
    expect(await verify(tanzania, token, { method: "POST" })).toEqual({ ok: false, reason: "wrong_request" });
    expect(await verify(tanzania, token, { path: "/api/admin/v1/orders" })).toEqual({ ok: false, reason: "wrong_request" });
    expect(await verify(tanzania, token, { path: "/api/admin/v1/health?country=KE" })).toEqual({ ok: false, reason: "wrong_request" });
    expect(await verify(tanzania, token, { body: '{"status":"delivered"}' })).toEqual({ ok: false, reason: "wrong_request" });

    const withBody = await sign({ method: "POST", path: "/api/admin/v1/orders/1", body: '{"status":"packed"}', permission: "orders.update" });
    const post = { method: "POST", path: "/api/admin/v1/orders/1", requiredPermission: "orders.update" };
    expect(await verify(tanzania, withBody, { ...post, body: '{"status":"packed"}' })).toMatchObject({ ok: true });
    expect(await verify(tanzania, withBody, { ...post, body: '{"status":"delivered"}' })).toEqual({ ok: false, reason: "wrong_request" });
  });

  it("are refused without a token, with a token signed by another key, or with an unknown key id", async () => {
    expect(await tanzania.verify({ authorization: null, requiredPermission: "settings.read", ...request })).toEqual({ ok: false, reason: "missing_token" });
    expect(await tanzania.verify({ authorization: "Basic abc", requiredPermission: "settings.read", ...request })).toEqual({
      ok: false,
      reason: "missing_token",
    });
    const forged = await (await createServiceTokenSigner({ privateKeyPem: otherPrivate, keyId: "k1" })).sign({
      countryCode: "TZ",
      actorId: ACTOR,
      permission: "settings.read",
      ...request,
    });
    expect(await verify(tanzania, forged)).toEqual({ ok: false, reason: "invalid_signature" });
    const unknownKey = await (await createServiceTokenSigner({ privateKeyPem: adminPrivate, keyId: "k9" })).sign({
      countryCode: "TZ",
      actorId: ACTOR,
      permission: "settings.read",
      ...request,
    });
    expect(await verify(tanzania, unknownKey)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("are refused when the token was changed after signing", async () => {
    const [header, payload, signature] = (await sign()).split(".") as [string, string, string];
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const tampered = Buffer.from(JSON.stringify({ ...claims, aud: "tronic-country:KE", cty: "KE" })).toString("base64url");
    expect(await verify(kenya, `${header}.${tampered}.${signature}`)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("expire after a minute", async () => {
    const past = await createServiceTokenSigner({ privateKeyPem: adminPrivate, keyId: "k1", now: () => new Date(Date.now() - 5 * 60_000) });
    const token = await past.sign({ countryCode: "TZ", actorId: ACTOR, permission: "settings.read", ...request });
    expect(await verify(tanzania, token)).toEqual({ ok: false, reason: "expired" });
  });

  it("are refused when they claim a longer life than the signer gives, or carry no signature", async () => {
    const key = await importPKCS8(adminPrivate, "ES256");
    const now = Math.floor(Date.now() / 1000);
    const longLived = await new SignJWT({ act: "settings.read", cty: "TZ", req: { m: "GET", p: request.path, bh: "" } })
      .setProtectedHeader({ alg: "ES256", kid: "k1", typ: "JWT" })
      .setIssuer("tronic-central-admin")
      .setAudience("tronic-country:TZ")
      .setSubject(ACTOR)
      .setJti("long")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    expect(await verify(tanzania, longLived)).toEqual({ ok: false, reason: "malformed" });

    const unsigned = [
      Buffer.from(JSON.stringify({ alg: "none", kid: "k1", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ iss: "tronic-central-admin", aud: "tronic-country:TZ", sub: ACTOR, act: "settings.read", cty: "TZ" })).toString("base64url"),
      "AAAA",
    ].join(".");
    expect(await verify(tanzania, unsigned)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("are refused the second time when a replay guard is in place", async () => {
    const guarded = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: adminPublic }, seenBefore: createMemoryReplayGuard() });
    const token = await sign();
    expect(await verify(guarded, token)).toMatchObject({ ok: true });
    expect(await verify(guarded, token)).toEqual({ ok: false, reason: "replayed" });
    expect(await verify(guarded, await sign())).toMatchObject({ ok: true });
  });

  it("cannot be signed without a country code, a permission or an actor", async () => {
    await expect(sign({ countryCode: "tz" })).rejects.toThrow(/country code/);
    await expect(sign({ permission: "everything" })).rejects.toThrow(/permission/);
    await expect(sign({ actorId: "" })).rejects.toThrow(/actor/);
  });
});

describe("country admin API adapter", () => {
  let server: Server;
  let baseUrl: string;
  /** What the stand-in country answers next. */
  let respond: (ok: (body: unknown) => void, raw: (status: number, body: string, headers?: Record<string, string>) => void) => void;

  beforeAll(async () => {
    // A stand-in country API for Tanzania that verifies every request with the real verifier.
    server = createServer((incoming, outgoing) => {
      void (async () => {
        const raw = (status: number, body: string, headers: Record<string, string> = {}) =>
          outgoing.writeHead(status, { "content-type": "application/json", ...headers }).end(body);
        const verified = await tanzania.verify({
          authorization: incoming.headers.authorization,
          requiredPermission: COUNTRY_ADMIN_ENDPOINTS.health.permission,
          method: incoming.method ?? "",
          path: incoming.url ?? "",
          body: "",
        });
        if (!verified.ok) return raw(401, JSON.stringify({ ok: false, code: verified.reason }));
        respond((body) => raw(200, JSON.stringify(body)), raw);
      })();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const healthy = { ok: true, country: "TZ", dataSource: "database", database: true, time: new Date().toISOString() };
  const api = (overrides: Partial<Parameters<typeof createCountryAdminApi>[0]> = {}) =>
    createCountryAdminApi({ baseUrl, countryCode: "TZ", signer, allowInsecureLoopback: true, timeoutMs: 500, ...overrides });

  it("returns the country's answer when the signed request is accepted", async () => {
    respond = (ok) => ok(healthy);
    const result = await api().health(ACTOR);
    expect(result).toMatchObject({ available: true, statusCode: 200, data: { country: "TZ", dataSource: "database", database: true } });
  });

  it("reports a refusal when the request was signed for another country", async () => {
    respond = (ok) => ok(healthy);
    expect(await api({ countryCode: "KE" }).health(ACTOR)).toMatchObject({ available: false, reason: "rejected", statusCode: 401 });
  });

  it("does not accept an answer that is not what the contract says, or that names another country", async () => {
    respond = (ok) => ok({ ok: true, country: "TZ" });
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "invalid_response" });
    respond = (_ok, raw) => raw(200, "<html>maintenance</html>");
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "invalid_response" });
    respond = (ok) => ok({ ...healthy, country: "KE" });
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "invalid_response" });
  });

  it("reports missing endpoints, server errors, redirects, timeouts and dead addresses as unavailable", async () => {
    respond = (_ok, raw) => raw(404, "{}");
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "not_found", statusCode: 404 });
    respond = (_ok, raw) => raw(503, "{}");
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "server_error", statusCode: 503 });
    // A redirect is never followed: the signed request must not travel to another host.
    respond = (_ok, raw) => raw(302, "", { location: "http://127.0.0.1:9/elsewhere" });
    expect(await api().health(ACTOR)).toMatchObject({ available: false, reason: "invalid_response" });
    respond = () => undefined; // never answers
    expect(await api({ timeoutMs: 150 }).health(ACTOR)).toMatchObject({ available: false, reason: "timeout", statusCode: null });
    expect(await api({ baseUrl: "http://127.0.0.1:9" }).health(ACTOR)).toMatchObject({ available: false, reason: "unreachable" });
  });

  it("refuses a service address that is not HTTPS", () => {
    expect(() => createCountryAdminApi({ baseUrl: "http://tz.example.test", countryCode: "TZ", signer })).toThrow(/HTTPS/);
    expect(() => createCountryAdminApi({ baseUrl: "http://127.0.0.1:3000", countryCode: "TZ", signer })).toThrow(/HTTPS/);
    expect(() => createCountryAdminApi({ baseUrl: "http://tz.example.test", countryCode: "TZ", signer, allowInsecureLoopback: true })).toThrow(/HTTPS/);
  });

  it("answers with the reason, and sends nothing, for a country that is not connected", async () => {
    expect(await unavailableCountryApi("not_configured").health(ACTOR)).toEqual({
      available: false,
      reason: "not_configured",
      statusCode: null,
      latencyMs: null,
    });
  });
});
