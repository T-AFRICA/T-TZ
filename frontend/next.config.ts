import type { NextConfig } from "next";

/**
 * Response headers for every route. There is no backend, no third-party
 * script and no embedded frame yet, so the policy can be strict now and
 * loosened deliberately (with nonces) when a payment SDK or analytics
 * script is introduced. `unsafe-inline` for scripts is what Next.js needs
 * for its own hydration bootstrap without a nonce; styles are inline too.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Dev only: Next.js hot reloading evaluates module code and uses eval
  // source maps. Production bundles never need it.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
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
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Two years, subdomains included. Vercel sets HSTS on its edge too; this
  // keeps the guarantee if the host changes. Submit to the preload list only
  // once every subdomain of tronic.tz is known to serve HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // The browser tests build into their own folder so they never touch the
  // .next folder of a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  transpilePackages: [
    "@tronic/ui",
    "@tronic/types",
    "@tronic/api-client",
    "@tronic/country-config",
    "@tronic/database",
  ],
  // The Postgres driver stays a plain Node dependency of the server bundle.
  serverExternalPackages: ["postgres"],
  images: {
    qualities: [75, 85, 90],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
