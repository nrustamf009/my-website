import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  // PDF fonts are read from disk at runtime; include them in every serverless bundle.
  outputFileTracingIncludes: { "/**": ["./lib/pdf/fonts/**"] },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
