import type { NextConfig } from "next";

/**
 * Response headers for every route of the Central Admin. Same policy as the
 * storefront (no third-party script, no frames), plus a header that keeps
 * the whole application out of search indexes. Every page reads the session
 * (server/session.ts), so Next.js renders each one per request and marks it
 * as not cacheable.
 * `unsafe-inline` for scripts is what Next.js needs for its own hydration
 * bootstrap without a nonce.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Adobe Fonts web project (Myriad Pro), as on the storefront.
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net",
  // data: carries the QR code Supabase Auth returns for authenticator set-up.
  "img-src 'self' data:",
  "font-src 'self' https://use.typekit.net",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  // geolocation=(self): a rider's phone shares its location while an order is on its way (the browser still asks the rider).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // The browser tests build into their own folder so they never touch the
  // .next folder of a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  transpilePackages: ["@tronic/ui", "@tronic/database", "@tronic/permissions", "@tronic/api-contracts", "@tronic/api-client", "@tronic/country-config", "@tronic/types"],
  // The Postgres driver stays a plain Node dependency of the server bundle.
  serverExternalPackages: ["postgres"],
  // A rider's delivery step carries a photo and a signature (each at most
  // 1 MB, made smaller on the phone first).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
