import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure SWA v2 handles Next.js build output natively
  // @ts-expect-error -- eslint config supported at runtime but missing from NextConfig type in v16
  eslint: {
    ignoreDuringBuilds: true,
  },
  // @ts-expect-error -- typescript config supported at runtime but missing from NextConfig type in v16
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
