import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * TEST ONLY: a minimal stand-in for Supabase Auth (GoTrue) for the admin
 * browser tests and the local preview, because no Central Admin Supabase
 * project exists yet. It implements just the endpoints supabase-js calls
 * from the admin's server actions: password sign-in, token refresh, user,
 * logout, and the authenticator (TOTP) calls: enroll, challenge, verify,
 * unenroll. Users live in memory. It has no sign-up endpoint, like the
 * admin application itself.
 *
 * The second factor is not a real TOTP: any factor accepts the one code in
 * TEST_TOTP_CODE. It is never used by the application outside these runs
 * and proves nothing about Supabase itself.
 */
export const TEST_TOTP_CODE = "246810";
/** Shown on the set-up page in place of a real authenticator key. */
const TEST_AUTHENTICATOR_KEY = "TEST".repeat(8);

interface FakeFactor {
  id: string;
  status: "unverified" | "verified";
}

export interface FakeUser {
  id: string;
  email: string;
  secret: string;
  confirmed: boolean;
  factors: FakeFactor[];
}

type Aal = "aal1" | "aal2";

// "connection: close": the application never reuses a socket to this stand-in, so a
// request cannot land on a kept-alive socket the stand-in is just closing.
const HEADERS = { "x-supabase-api-version": "2024-01-01", "content-type": "application/json", connection: "close" };

function base64url(value: object | Buffer): string {
  return (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString("base64url");
}

export class FakeAuth {
  readonly users = new Map<string, FakeUser>();
  private tokens = new Map<string, { email: string; aal: Aal }>();
  private refresh = new Map<string, { email: string; aal: Aal }>();
  private server: Server | null = null;

  constructor(private readonly onUserCreated: (user: FakeUser) => Promise<void>) {}

  /** `secret` is what the person types into the password field. */
  async addUser(email: string, secret: string, options: { confirmed?: boolean; authenticator?: boolean } = {}): Promise<FakeUser> {
    const user: FakeUser = {
      id: randomUUID(),
      email: email.toLowerCase(),
      secret,
      confirmed: options.confirmed !== false,
      factors: options.authenticator ? [{ id: randomUUID(), status: "verified" }] : [],
    };
    this.users.set(user.email, user);
    await this.onUserCreated(user);
    return user;
  }

  /** Ends every session of a user: their tokens stop working. */
  revokeSessions(email: string): void {
    const target = email.toLowerCase();
    for (const [token, owner] of this.tokens) if (owner.email === target) this.tokens.delete(token);
    for (const [token, owner] of this.refresh) if (owner.email === target) this.refresh.delete(token);
  }

  private userJson(user: FakeUser) {
    const now = new Date().toISOString();
    return {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: user.confirmed ? now : null,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      factors: user.factors.map((factor) => ({
        id: factor.id,
        friendly_name: "TRONIC Central Admin",
        factor_type: "totp",
        status: factor.status,
        created_at: now,
        updated_at: now,
      })),
      created_at: now,
      updated_at: now,
    };
  }

  private session(user: FakeUser, aal: Aal) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const amr = [{ method: "password", timestamp: exp - 3600 }, ...(aal === "aal2" ? [{ method: "totp", timestamp: exp - 3600 }] : [])];
    const accessToken = [
      base64url({ alg: "HS256", typ: "JWT" }),
      base64url({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600, aal, amr, session_id: randomUUID() }),
      base64url(randomBytes(32)),
    ].join(".");
    const refreshToken = randomBytes(24).toString("hex");
    this.tokens.set(accessToken, { email: user.email, aal });
    this.refresh.set(refreshToken, { email: user.email, aal });
    return { access_token: accessToken, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refreshToken, user: this.userJson(user) };
  }

  private caller(request: IncomingMessage): { user: FakeUser; aal: Aal } | null {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const owner = this.tokens.get(token);
    const user = owner ? this.users.get(owner.email) : undefined;
    return owner && user ? { user, aal: owner.aal } : null;
  }

  async start(port: number): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(() => send(response, 500, { code: "unexpected_failure", msg: "error" }));
    });
    await new Promise<void>((resolve) => this.server!.listen(port, "127.0.0.1", resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = parseJson(await readBody(request));
    const route = `${request.method} ${url.pathname}`;
    const unauthorized = () => send(response, 403, { code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" });

    if (route === "POST /auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const user = this.users.get(String(body.email ?? "").toLowerCase());
      if (!user || user.secret !== body.password) {
        return send(response, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      }
      if (!user.confirmed) return send(response, 400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
      return send(response, 200, this.session(user, "aal1"));
    }
    if (route === "POST /auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const owner = this.refresh.get(String(body.refresh_token ?? ""));
      const user = owner ? this.users.get(owner.email) : undefined;
      if (!owner || !user) return send(response, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return send(response, 200, this.session(user, owner.aal));
    }
    if (route === "GET /auth/v1/user") {
      const caller = this.caller(request);
      return caller ? send(response, 200, this.userJson(caller.user)) : unauthorized();
    }
    if (route === "POST /auth/v1/logout") {
      this.tokens.delete(request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "");
      response.writeHead(204, { connection: "close" }).end();
      return;
    }

    // ------------------------------------------------- authenticator (TOTP) --
    const caller = this.caller(request);
    if (route === "POST /auth/v1/factors") {
      if (!caller) return unauthorized();
      const factor: FakeFactor = { id: randomUUID(), status: "unverified" };
      caller.user.factors.push(factor);
      return send(response, 200, {
        id: factor.id,
        type: "totp",
        friendly_name: String(body.friendly_name ?? ""),
        totp: {
          // supabase-js turns this SVG into a data: URI for the page.
          qr_code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><rect width="90" height="90" fill="#fff"/><rect x="10" y="10" width="26" height="26"/><rect x="54" y="10" width="26" height="26"/><rect x="10" y="54" width="26" height="26"/><rect x="46" y="46" width="12" height="12"/></svg>`,
          secret: TEST_AUTHENTICATOR_KEY,
          uri: "otpauth://totp/TRONIC%20Central%20Admin?issuer=test",
        },
      });
    }
    const factorRoute = /^\/auth\/v1\/factors\/([0-9a-f-]{36})(\/challenge|\/verify)?$/.exec(url.pathname);
    if (factorRoute) {
      if (!caller) return unauthorized();
      const factor = caller.user.factors.find((candidate) => candidate.id === factorRoute[1]);
      if (!factor) return send(response, 404, { code: 404, error_code: "mfa_factor_not_found", msg: "Factor not found" });
      if (request.method === "DELETE" && !factorRoute[2]) {
        caller.user.factors = caller.user.factors.filter((candidate) => candidate.id !== factor.id);
        return send(response, 200, { id: factor.id });
      }
      if (request.method === "POST" && factorRoute[2] === "/challenge") {
        return send(response, 200, { id: randomUUID(), type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
      }
      if (request.method === "POST" && factorRoute[2] === "/verify") {
        if (body.code !== TEST_TOTP_CODE) {
          return send(response, 422, { code: 422, error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" });
        }
        factor.status = "verified";
        return send(response, 200, this.session(caller.user, "aal2"));
      }
    }
    return send(response, 404, { code: 404, error_code: "not_found", msg: "not found" });
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, HEADERS).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function parseJson(raw: Buffer): Record<string, unknown> {
  const text = raw.toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
