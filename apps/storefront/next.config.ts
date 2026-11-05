import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@tronic/ui",
    "@tronic/types",
    "@tronic/api-client",
    "@tronic/country-config",
  ],
  images: {
    qualities: [75, 85, 90],
  },
};

export default nextConfig;
