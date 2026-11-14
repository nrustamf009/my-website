import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  // PDF fonts and the Lambda Prisma engine are read from disk at runtime; include them in every serverless bundle.
  outputFileTracingIncludes: { "/**": ["./src/design/fonts/**", "./node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node", "./node_modules/.prisma/client/schema.prisma", "./prisma/demo.db"] },
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
