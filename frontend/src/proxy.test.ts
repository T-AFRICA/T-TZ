// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The session proxy with the Auth client replaced: who is let through, who
 * is redirected, and that the cookie of a session that has ended is removed
 * once instead of being asked about on every page.
 */
const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookies: null as null | { getAll: () => { name: string; value: string }[]; setAll: (list: { name: string; value: string; options?: object }[]) => void },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: NonNullable<typeof auth.cookies> }) => {
    auth.cookies = options.cookies;
    return { auth: { getUser: auth.getUser } };
  },
}));

import { config, proxy } from "./proxy";

const ORIGIN = "https://shop.example.test";
const SESSION = "sb-testproject-auth-token";
const ENV = { ...process.env };

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(`${ORIGIN}${path}`, header ? { headers: { cookie: header } } : undefined);
}

/** Cookies a response tells the browser to delete. */
function expired(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((line) => /max-age=0/i.test(line))
    .map((line) => line.split("=")[0]!);
}

const signedIn = { data: { user: { id: "u" } }, error: null };
const noSession = { data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } };
const revoked = { data: { user: null }, error: { name: "AuthApiError", status: 403, code: "session_not_found" } };
const unreachable = { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://testproject.example.test";
  process.env.SUPABASE_ANON_KEY = "anon";
  auth.getUser.mockReset();
  auth.cookies = null;
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("session proxy", () => {
  it("covers the account pages and the sign-in and register pages only", () => {
    expect(config.matcher).toEqual(["/account/:path*", "/login/:path*", "/register"]);
  });

  it("without Supabase Auth: account pages go to sign-in, the sign-in page is left alone", async () => {
    delete process.env.SUPABASE_URL;
    const account = await proxy(request("/account/orders", { [SESSION]: "x" }));
    expect(account.status).toBe(303);
    expect(account.headers.get("location")).toBe(`${ORIGIN}/login`);
    const login = await proxy(request("/login"));
    expect(login.headers.get("location")).toBeNull();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("lets a signed-in customer into the account and sends them there from sign-in and register", async () => {
    auth.getUser.mockResolvedValue(signedIn);
    const account = await proxy(request("/account", { [SESSION]: "x" }));
    expect(account.headers.get("location")).toBeNull();
    for (const path of ["/login", "/login/registered", "/register"]) {
      const response = await proxy(request(path, { [SESSION]: "x" }));
      expect(response.status, path).toBe(303);
      expect(response.headers.get("location"), path).toBe(`${ORIGIN}/account`);
      expect(expired(response), path).toEqual([]);
    }
  });

  it("keeps a refreshed session cookie when it redirects", async () => {
    auth.getUser.mockImplementationOnce(async () => {
      auth.cookies!.setAll([{ name: SESSION, value: "refreshed", options: { path: "/", maxAge: 3600 } }]);
      return signedIn;
    });
    const response = await proxy(request("/login", { [SESSION]: "old" }));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/account`);
    expect(response.headers.getSetCookie().join("\n")).toContain(`${SESSION}=refreshed`);
  });

  it("asks the Auth server nothing for a visitor on the sign-in or register page", async () => {
    for (const path of ["/login", "/register"]) {
      const response = await proxy(request(path, { theme: "light", "sb-testproject-auth-token-code-verifier": "v" }));
      expect(response.headers.get("location"), path).toBeNull();
    }
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session from the account to sign-in", async () => {
    auth.getUser.mockResolvedValue(noSession);
    const response = await proxy(request("/account"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
  });

  it("removes the cookie of a session that has ended, on the account and on the sign-in page", async () => {
    auth.getUser.mockResolvedValue(revoked);
    const cookies = { [`${SESSION}.0`]: "part", [`${SESSION}.1`]: "rest", "sb-testproject-auth-token-code-verifier": "v", theme: "light" };

    const account = await proxy(request("/account/orders", cookies));
    expect(account.status).toBe(303);
    expect(account.headers.get("location")).toBe(`${ORIGIN}/login`);
    // Both parts of the session cookie, and nothing else.
    expect(expired(account).sort()).toEqual([`${SESSION}.0`, `${SESSION}.1`]);

    const login = await proxy(request("/login", cookies));
    expect(login.headers.get("location")).toBeNull();
    expect(expired(login).sort()).toEqual([`${SESSION}.0`, `${SESSION}.1`]);
    // The page behind the proxy no longer sees the dead cookie either.
    expect(login.headers.get("x-middleware-request-cookie") ?? "").not.toContain(`${SESSION}.0=`);
  });

  it("keeps the cookie when the Auth server could not be reached", async () => {
    auth.getUser.mockResolvedValue(unreachable);
    const account = await proxy(request("/account", { [SESSION]: "x" }));
    expect(account.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(expired(account)).toEqual([]);
    const login = await proxy(request("/login", { [SESSION]: "x" }));
    expect(login.headers.get("location")).toBeNull();
    expect(expired(login)).toEqual([]);

    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", status: 429 } });
    expect(expired(await proxy(request("/account", { [SESSION]: "x" })))).toEqual([]);
  });
});
