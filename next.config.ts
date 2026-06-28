import type { NextConfig } from "next";

// next-pwa is a CJS package with no TS declarations compatible with Next.js 16;
// require() avoids the type version mismatch produced by @types/next-pwa.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa") as (
  opts: Record<string, unknown>,
) => (cfg: NextConfig) => NextConfig;

const nextConfig: NextConfig = {
  // turbopack: {} silences Next.js 16's webpack/turbopack conflict warning
  // triggered by next-pwa injecting a webpack plugin.
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
