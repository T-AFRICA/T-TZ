import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@tronic/ui",
    "@tronic/types",
    "@tronic/api-client",
    "@tronic/country-config",
  ],
};

export default nextConfig;
