import { SignJWT, importPKCS8, importSPKI, jwtVerify, errors as joseErrors } from "jose";

/**
 * Signed server-to-server requests between the Central Admin and a country
 * API (Central Admin backend -> country backend, never a browser).
 *
 * Each request carries a short-lived JSON Web Token (ES256, the `jose`
 * library) in the Authorization header. The Central Admin holds the private
 * key; a country holds only the matching public key, so a country that is
 * compromised cannot sign requests for another country.
 *
 * The token is bound to one request: the country it is for, the
 * administrator it is made for, the one permission it uses, and the method,
 * path and body it travels with. A country API verifies all of them itself
 * and trusts nothing else in the request, least of all a country id.
 */

export const SERVICE_TOKEN_ISSUER = "tronic-central-admin";
export const SERVICE_TOKEN_ALGORITHM = "ES256";
/** How long a token lives. A request takes seconds; a stolen token is useless soon after. */
export const SERVICE_TOKEN_TTL_SECONDS = 60;
/** Clock difference tolerated between the two servers. */
export const SERVICE_TOKEN_CLOCK_TOLERANCE_SECONDS = 10;

const PERMISSION = /^[a-z]+(\.[a-z_]+){1,2}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;

export type PemKind = "PUBLIC KEY" | "PRIVATE KEY";

/** Why a configured key cannot be used. Never carries the key or any part of it. */
export class KeyFormatError extends Error {
  constructor(
    readonly reason: "empty" | "wrong_kind" | "unreadable",
    readonly expected: PemKind,
  ) {
    super(
      reason === "empty"
        ? "no key is configured"
        : reason === "wrong_kind"
          ? `the configured value is not a ${expected}`
          : `the configured ${expected} cannot be read`,
    );
    this.name = "KeyFormatError";
  }
}

/**
 * A key as it arrives from an environment variable, made into the PEM text
 * the key importers accept. A value pasted into a hosting dashboard may
 * have its line breaks written as "\n", be wrapped in quotes, have lost its
 * line breaks, or be only the middle part without the BEGIN and END lines;
 * all of these are the same key. What is refused, with the reason: nothing
 * at all, the other half of the pair (a private key where the public one
 * belongs, or the reverse), and text that is not a key.
 */
export function normalizePem(value: string | undefined, kind: PemKind): string {
  let text = (value ?? "").replace(/\\r/g, "").replace(/\\n/g, "\n").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  if (!text) throw new KeyFormatError("empty", kind);

  const header = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(text);
  if (header && header[1] !== kind) throw new KeyFormatError(/PUBLIC|PRIVATE/.test(header[1] as string) ? "wrong_kind" : "unreadable", kind);
  const body = text.replace(/-----(BEGIN|END) [A-Z0-9 ]+-----/g, "").replace(/\s+/g, "");
  if (body.length < 80 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new KeyFormatError("unreadable", kind);
  return `-----BEGIN ${kind}-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END ${kind}-----\n`;
}

function audienceFor(countryCode: string): string {
  return `tronic-country:${countryCode}`;
}

async function sha256Base64Url(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Buffer.from(digest).toString("base64url");
}

/** The path and query of a request, as both sides must spell it: no origin, no fragment. */
export function canonicalPath(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url, "https://service.invalid") : url;
  return `${parsed.pathname}${parsed.search}`;
}

export interface ServiceRequestDescription {
  /** ISO 3166-1 alpha-2 code of the country the request is for, e.g. "TZ". */
  countryCode: string;
  /** The administrator the Central Admin is acting for (their user id). */
  actorId: string;
  /** The one permission this request uses, e.g. "orders.read". */
  permission: string;
  method: string;
  /** Path and query, e.g. "/api/admin/v1/health". */
  path: string;
  /** The exact request body text; "" when there is none. */
  body: string;
}

export interface ServiceTokenSigner {
  sign(request: ServiceRequestDescription): Promise<string>;
}

/**
 * The Central Admin's signer. `privateKeyPem` is a PKCS#8 P-256 private key
 * held only in the admin server's environment; `keyId` names it so a
 * country can hold two public keys while one is being replaced.
 */
export async function createServiceTokenSigner(options: { privateKeyPem: string; keyId: string; now?: () => Date }): Promise<ServiceTokenSigner> {
  let key: CryptoKey;
  try {
    key = await importPKCS8(normalizePem(options.privateKeyPem, "PRIVATE KEY"), SERVICE_TOKEN_ALGORITHM);
  } catch (error) {
    throw error instanceof KeyFormatError ? error : new KeyFormatError("unreadable", "PRIVATE KEY");
  }
  const now = options.now ?? (() => new Date());
  return {
    async sign(request) {
      if (!COUNTRY_CODE.test(request.countryCode)) throw new Error("service token: a two-letter country code is required");
      if (!PERMISSION.test(request.permission)) throw new Error("service token: a permission key is required");
      if (!request.actorId) throw new Error("service token: an actor is required");
      const issuedAt = Math.floor(now().getTime() / 1000);
      return new SignJWT({
        act: request.permission,
        cty: request.countryCode,
        req: { m: request.method.toUpperCase(), p: canonicalPath(request.path), bh: await sha256Base64Url(request.body) },
      })
        .setProtectedHeader({ alg: SERVICE_TOKEN_ALGORITHM, kid: options.keyId, typ: "JWT" })
        .setIssuer(SERVICE_TOKEN_ISSUER)
        .setAudience(audienceFor(request.countryCode))
        .setSubject(request.actorId)
        .setJti(crypto.randomUUID())
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + SERVICE_TOKEN_TTL_SECONDS)
        .sign(key);
    },
  };
}

export type ServiceTokenRejection =
  | "missing_token"
  | "invalid_signature"
  | "expired"
  | "wrong_country"
  | "wrong_permission"
  | "wrong_request"
  | "replayed"
  | "malformed";

export type ServiceTokenVerification =
  | { ok: true; actorId: string; permission: string; countryCode: string; tokenId: string; expiresAt: number }
  | { ok: false; reason: ServiceTokenRejection };

export interface ServiceTokenVerifier {
  verify(input: {
    /** The Authorization header value, "Bearer <token>". */
    authorization: string | null | undefined;
    /** The permission this endpoint requires. The token must name exactly this one. */
    requiredPermission: string;
    method: string;
    /** The request's path and query as received. */
    path: string;
    /** The exact request body text as received; "" when there is none. */
    body: string;
  }): Promise<ServiceTokenVerification>;
}

/**
 * A country API's verifier. `countryCode` is the country this deployment
 * serves, taken from its own configuration. `publicKeysPem` maps key ids to
 * SPKI public keys of the Central Admin. `seenBefore` is the replay guard:
 * it is told each accepted token id with its expiry and answers true when
 * that id was already used; a deployment that changes data must back it
 * with shared storage, not memory.
 */
export async function createServiceTokenVerifier(options: {
  countryCode: string;
  publicKeysPem: Record<string, string>;
  seenBefore?: (tokenId: string, expiresAt: number) => Promise<boolean> | boolean;
  now?: () => Date;
}): Promise<ServiceTokenVerifier> {
  if (!COUNTRY_CODE.test(options.countryCode)) throw new Error("service token verifier: a two-letter country code is required");
  const keys = new Map<string, CryptoKey>();
  for (const [keyId, pem] of Object.entries(options.publicKeysPem)) {
    try {
      keys.set(keyId, await importSPKI(normalizePem(pem, "PUBLIC KEY"), SERVICE_TOKEN_ALGORITHM));
    } catch (error) {
      throw error instanceof KeyFormatError ? error : new KeyFormatError("unreadable", "PUBLIC KEY");
    }
  }
  if (keys.size === 0) throw new Error("service token verifier: at least one public key is required");
  const now = options.now ?? (() => new Date());

  return {
    async verify(input) {
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(input.authorization ?? "");
      if (!match) return { ok: false, reason: "missing_token" };

      let payload: Record<string, unknown>;
      try {
        const verified = await jwtVerify(
          match[1] as string,
          (header) => {
            const key = header.kid ? keys.get(header.kid) : undefined;
            if (!key) throw new joseErrors.JWSSignatureVerificationFailed();
            return key;
          },
          {
            algorithms: [SERVICE_TOKEN_ALGORITHM],
            issuer: SERVICE_TOKEN_ISSUER,
            typ: "JWT",
            clockTolerance: SERVICE_TOKEN_CLOCK_TOLERANCE_SECONDS,
            currentDate: now(),
            requiredClaims: ["exp", "iat", "jti", "sub", "aud"],
          },
        );
        payload = verified.payload as Record<string, unknown>;
      } catch (error) {
        if (error instanceof joseErrors.JWTExpired) return { ok: false, reason: "expired" };
        if (error instanceof joseErrors.JWTClaimValidationFailed) return { ok: false, reason: "malformed" };
        return { ok: false, reason: "invalid_signature" };
      }

      const { exp, iat, jti, sub, aud, act, cty, req } = payload;
      if (typeof exp !== "number" || typeof iat !== "number" || typeof jti !== "string" || typeof sub !== "string" || !sub) {
        return { ok: false, reason: "malformed" };
      }
      // A token may not claim a longer life than the signer gives, nor come from the future.
      const nowSeconds = Math.floor(now().getTime() / 1000);
      if (exp - iat > SERVICE_TOKEN_TTL_SECONDS || iat > nowSeconds + SERVICE_TOKEN_CLOCK_TOLERANCE_SECONDS) {
        return { ok: false, reason: "malformed" };
      }
      if (aud !== audienceFor(options.countryCode) || cty !== options.countryCode) return { ok: false, reason: "wrong_country" };
      if (typeof act !== "string" || act !== input.requiredPermission) return { ok: false, reason: "wrong_permission" };

      const bound = req as { m?: unknown; p?: unknown; bh?: unknown } | undefined;
      if (
        !bound ||
        bound.m !== input.method.toUpperCase() ||
        bound.p !== canonicalPath(input.path) ||
        bound.bh !== (await sha256Base64Url(input.body))
      ) {
        return { ok: false, reason: "wrong_request" };
      }

      if (options.seenBefore && (await options.seenBefore(jti, exp))) return { ok: false, reason: "replayed" };
      return { ok: true, actorId: sub, permission: act, countryCode: options.countryCode, tokenId: jti, expiresAt: exp };
    },
  };
}

/**
 * An in-memory replay guard for one server process: enough for read-only
 * endpoints and tests. It forgets ids once their token has expired.
 */
export function createMemoryReplayGuard(now: () => Date = () => new Date()): (tokenId: string, expiresAt: number) => boolean {
  const seen = new Map<string, number>();
  return (tokenId, expiresAt) => {
    const nowSeconds = Math.floor(now().getTime() / 1000);
    for (const [id, expiry] of seen) {
      if (expiry + SERVICE_TOKEN_CLOCK_TOLERANCE_SECONDS < nowSeconds) seen.delete(id);
    }
    if (seen.has(tokenId)) return true;
    seen.set(tokenId, expiresAt);
    return false;
  };
}
