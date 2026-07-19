import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  // `pnpm start` (next start) continues to work unchanged with this enabled.
  output: "standalone",
};

export default nextConfig;
