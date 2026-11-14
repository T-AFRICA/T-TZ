import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * TEST ONLY: a minimal stand-in for Supabase Auth (GoTrue) for the browser
 * tests, because no Supabase project exists for this repository yet. It
 * implements just the endpoints supabase-js calls from the storefront's
 * server actions (password sign-in, sign-up, recovery, user, update,
 * refresh, logout) with in-memory users, plus the three Supabase Storage
 * calls behind the profile photo (upload, download, remove) with the same
 * owner rule as migration 0005. It is never used by the app outside the
 * e2e run and proves nothing about Supabase itself.
 */
export interface FakeUser {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  metadata: Record<string, unknown>;
}

const API_VERSION = { "x-supabase-api-version": "2024-01-01", "content-type": "application/json" };

function base64url(value: object | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return buffer.toString("base64url");
}

export class FakeAuth {
  readonly users = new Map<string, FakeUser>();
  private tokens = new Map<string, string>();
  private refresh = new Map<string, string>();
  /** How many times the app asked who a token belongs to (GET /auth/v1/user). */
  userLookups = 0;
  /** Stored objects by "bucket/name". */
  private objects = new Map<string, { type: string; bytes: Buffer }>();
  private server: Server | null = null;

  constructor(private readonly onUserCreated: (user: FakeUser) => Promise<void>) {}

  async addUser(email: string, password: string, confirmed = true, metadata: Record<string, unknown> = {}): Promise<FakeUser> {
    const user: FakeUser = { id: randomUUID(), email: email.toLowerCase(), password, confirmed, metadata };
    this.users.set(user.email, user);
    await this.onUserCreated(user);
    return user;
  }

  /** Ends every session of a user, as a sign-out on another device does: their tokens stop working. */
  revokeSessions(email: string): void {
    const target = email.toLowerCase();
    for (const [token, owner] of this.tokens) if (owner === target) this.tokens.delete(token);
    for (const [token, owner] of this.refresh) if (owner === target) this.refresh.delete(token);
  }

  private userJson(user: FakeUser) {
    return {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: user.confirmed ? new Date().toISOString() : null,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: user.metadata,
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private session(user: FakeUser) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = [
      base64url({ alg: "HS256", typ: "JWT" }),
      base64url({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600 }),
      base64url(randomBytes(32)),
    ].join(".");
    const refreshToken = randomBytes(24).toString("hex");
    this.tokens.set(accessToken, user.email);
    this.refresh.set(refreshToken, user.email);
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: exp,
      refresh_token: refreshToken,
      user: this.userJson(user),
    };
  }

  private userFromRequest(request: IncomingMessage): FakeUser | null {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const email = this.tokens.get(token);
    return email ? (this.users.get(email) ?? null) : null;
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
    const raw = await readBody(request);
    if (url.pathname.startsWith("/storage/v1/object/")) return this.handleStorage(request, response, url, raw);
    const body = parseJson(raw);
    const route = `${request.method} ${url.pathname}`;

    if (route === "POST /auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const user = this.users.get(String(body.email ?? "").toLowerCase());
      if (!user || user.password !== body.password) {
        return send(response, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      }
      if (!user.confirmed) return send(response, 400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
      return send(response, 200, this.session(user));
    }
    if (route === "POST /auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const email = this.refresh.get(String(body.refresh_token ?? ""));
      const user = email ? this.users.get(email) : undefined;
      if (!user) return send(response, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return send(response, 200, this.session(user));
    }
    if (route === "POST /auth/v1/signup") {
      const email = String(body.email ?? "").toLowerCase();
      const existing = this.users.get(email);
      // Like Supabase with confirmations on: the same answer for a new or a
      // known address, and no session until the email is confirmed.
      const user = existing ?? (await this.addUser(email, String(body.password ?? ""), false, (body.data as Record<string, unknown>) ?? {}));
      return send(response, 200, this.userJson(user));
    }
    if (route === "POST /auth/v1/recover") return send(response, 200, {});
    if (route === "GET /auth/v1/user") {
      this.userLookups += 1;
      const user = this.userFromRequest(request);
      // Supabase answers 403 session_not_found for a token whose session has ended.
      return user
        ? send(response, 200, this.userJson(user))
        : send(response, 403, { code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" });
    }
    if (route === "PUT /auth/v1/user") {
      const user = this.userFromRequest(request);
      if (!user) return send(response, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      if (typeof body.password === "string") user.password = body.password;
      // Profile updates (updateUser({ data })) merge into the user metadata, as Supabase does.
      if (body.data && typeof body.data === "object") user.metadata = { ...user.metadata, ...(body.data as Record<string, unknown>) };
      return send(response, 200, this.userJson(user));
    }
    if (route === "POST /auth/v1/logout") {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      this.tokens.delete(token);
      response.writeHead(204).end();
      return;
    }
    return send(response, 404, { code: 404, error_code: "not_found", msg: "not found" });
  }

  /**
   * Storage for the "avatars" bucket only, with migration 0005's rule: a
   * signed-in user may touch "<their id>/avatar" and nothing else.
   */
  private handleStorage(request: IncomingMessage, response: ServerResponse, url: URL, raw: Buffer) {
    const denied = () => send(response, 400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    const user = this.userFromRequest(request);
    const [bucket, ...rest] = decodeURIComponent(url.pathname.slice("/storage/v1/object/".length)).split("/");
    const name = rest.join("/");
    const own = user ? `${user.id}/avatar` : null;
    if (bucket !== "avatars") return send(response, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });

    if (request.method === "POST" || request.method === "PUT") {
      if (!own || name !== own) return denied();
      if (raw.byteLength > 2 * 1024 * 1024) return send(response, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
      this.objects.set(`avatars/${name}`, { type: String(request.headers["content-type"] ?? "application/octet-stream"), bytes: raw });
      return send(response, 200, { Id: randomUUID(), Key: `avatars/${name}` });
    }
    if (request.method === "GET") {
      const object = own && name === own ? this.objects.get(`avatars/${name}`) : undefined;
      if (!object) return send(response, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      response.writeHead(200, { "content-type": object.type, "content-length": String(object.bytes.byteLength) }).end(object.bytes);
      return;
    }
    if (request.method === "DELETE") {
      const prefixes = parseJson(raw).prefixes;
      const removed: { name: string }[] = [];
      for (const prefix of Array.isArray(prefixes) ? prefixes.map(String) : []) {
        if (own && prefix === own && this.objects.delete(`avatars/${prefix}`)) removed.push({ name: prefix });
      }
      return send(response, 200, removed);
    }
    return send(response, 404, { statusCode: "404", error: "not_found", message: "not found" });
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, API_VERSION).end(JSON.stringify(body));
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
