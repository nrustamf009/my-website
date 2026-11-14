/**
 * Demo without sign-in (DEMO_LOGIN=true or development). Each demo broker maps to its seeded admin,
 * so every dashboard page opens directly; /go signs the visitor in as that account and redirects.
 */
/** Demo mode: on in development, or when DEMO_LOGIN=true. */
export function demoLoginEnabled() {
  return process.env.DEMO_LOGIN === "true" || process.env.NODE_ENV !== "production";
}

export const DEMO_BROKERS = [
  { slug: "harborline", name: "Harborline Lending", theme: "maison", email: "maya@harborline.example" },
  { slug: "cactus-ridge", name: "Cactus Ridge Mortgage", theme: "terminal", email: "daniel@cactusridge.example" },
  { slug: "evergreen-key", name: "Evergreen Key Capital", theme: "atelier", email: "priya@evergreenkey.example" },
] as const;

export const DEMO_AGENCY_EMAIL = "admin@northbeam.example";
export const DEMO_COOKIE = "demo_as";

export type DemoSlug = (typeof DEMO_BROKERS)[number]["slug"];

export function demoBroker(slug: string | null | undefined) {
  return DEMO_BROKERS.find((b) => b.slug === slug) ?? DEMO_BROKERS[0];
}

/** Five modules, in the order the demo presents them. `path` null = public page of the broker. */
export const DEMO_MODULES = [
  { n: 1, key: "check", title: "Instant Check", path: null },
  { n: 2, key: "scenarios", title: "Scenario Sheet", path: "/dashboard/scenarios" },
  { n: 3, key: "money-list", title: "Money List", path: "/dashboard/money-list" },
  { n: 4, key: "snapshots", title: "Listing Snapshot", path: "/dashboard/snapshots" },
  { n: 5, key: "notes", title: "Notes-to-Scenario", path: "/dashboard/notes" },
] as const;

export function demoModuleHref(m: (typeof DEMO_MODULES)[number], slug: string) {
  return m.path ? `/go?as=${slug}&to=${encodeURIComponent(m.path)}` : `/b/${slug}/check`;
}
