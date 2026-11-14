/**
 * Demo without sign-in. Each demo broker maps to its seeded admin,
 * so every dashboard page opens directly; /go signs the visitor in as that account and redirects.
 */
/**
 * Demo mode (no sign-in at all) is ON by default. Set DEMO_LOGIN=false for a real deployment with
 * magic-link sign-in.
 */
export function demoLoginEnabled() {
  return process.env.DEMO_LOGIN !== "false";
}

export const DEMO_BROKERS = [
  { slug: "harborline", name: "Harborline Lending", theme: "maison", email: "maya@harborline.example" },
  { slug: "cactus-ridge", name: "Cactus Ridge Mortgage", theme: "terminal", email: "daniel@cactusridge.example" },
  { slug: "evergreen-key", name: "Evergreen Key Capital", theme: "atelier", email: "priya@evergreenkey.example" },
] as const;

export const DEMO_AGENCY_EMAIL = "admin@northbeam.example";
export const DEMO_COOKIE = "demo_as";
/** Same value as IMPERSONATE_COOKIE in session.ts (kept here so client code can import this file). */
export const IMPERSONATE_COOKIE_NAME = "dscr_impersonate";

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
