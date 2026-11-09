import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
