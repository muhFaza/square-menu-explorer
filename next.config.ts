import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  // `pnpm start` (next start) continues to work unchanged with this enabled.
  output: "standalone",
  images: {
    // Square item images live in per-environment S3 buckets. Optimizing them
    // through /_next/image serves right-sized WebP from our own origin instead
    // of 70KiB cross-origin originals over HTTP/1.1 with no cache headers.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "items-images-sandbox.s3.us-west-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "items-images-production.s3.us-west-2.amazonaws.com",
      },
    ],
    // Square image URLs are content-addressed (the file hash is in the path),
    // so a long browser/server cache can never serve a stale rendition.
    minimumCacheTTL: 2_678_400, // 31 days
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // frame-ancestors only: a scripting CSP would break the inline
          // pre-hydration theme script and Next's inline runtime scripts.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
