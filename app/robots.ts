import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: ["/dashboard", "/admin", "/api", "/dev", "/b/*/s/", "/b/*/l/"] }] };
}
