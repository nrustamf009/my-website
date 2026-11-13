/** Fictional demo brokers. All names, NMLS IDs, emails (.example) and phones (555-01xx) are made up. */

function monogramSvg(letters: string, bg: string, fg = "#ffffff", shape: "circle" | "square" | "arch" = "square") {
  const bgShape =
    shape === "circle"
      ? `<circle cx="32" cy="32" r="30" fill="${bg}"/>`
      : shape === "arch"
        ? `<path d="M4 60V30a28 28 0 0 1 56 0v30z" fill="${bg}"/>`
        : `<rect x="2" y="2" width="60" height="60" rx="14" fill="${bg}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bgShape}<text x="32" y="${shape === "arch" ? 47 : 41}" text-anchor="middle" font-family="Georgia,serif" font-size="24" font-weight="700" fill="${fg}">${letters}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

import { DEFAULT_GRID, type ProgramGrid } from "../lib/dscr";

const grid = (patch: (g: ProgramGrid) => void): ProgramGrid => {
  const g = structuredClone(DEFAULT_GRID);
  patch(g);
  return g;
};

export const DEMO_BROKERS = [
  {
    slug: "harborline",
    companyName: "Harborline Lending",
    companyNmlsId: "2203117",
    accentColor: "#1F4E79",
    logoUrl: monogramSvg("HL", "#1F4E79", "#F2D27C", "square"),
    email: "hello@harborline.example",
    phone: "(555) 010-2240",
    websiteUrl: "https://harborline.example",
    privacyPolicyUrl: "https://harborline.example/privacy",
    licensedStates: ["TX", "FL", "GA", "NC"],
    tonePreset: "FRIENDLY",
    marketRateMilli: 6_625,
    status: "ACTIVE",
    programGrid: grid((g) => {
      g.baseRateMilli = 7_125;
    }),
    users: [
      { email: "maya@harborline.example", name: "Maya Castellano", role: "BROKER_ADMIN", nmlsId: "1849302", title: "Senior Loan Officer", phone: "(555) 010-2240", slug: "maya" },
      { email: "theo@harborline.example", name: "Theo Park", role: "LO", nmlsId: "2140077", title: "Loan Officer", phone: "(555) 010-2241", slug: "theo" },
    ],
  },
  {
    slug: "cactus-ridge",
    companyName: "Cactus Ridge Mortgage",
    companyNmlsId: "1650228",
    accentColor: "#B4532A",
    logoUrl: monogramSvg("CR", "#B4532A", "#FFF4E8", "arch"),
    email: "loans@cactusridge.example",
    phone: "(555) 010-7731",
    websiteUrl: "https://cactusridge.example",
    privacyPolicyUrl: "https://cactusridge.example/privacy",
    licensedStates: ["AZ", "NV", "NM", "UT"],
    tonePreset: "DIRECT",
    marketRateMilli: 6_750,
    status: "ACTIVE",
    programGrid: grid((g) => {
      g.baseRateMilli = 7_250;
      g.subOneDscrEnabled = true;
    }),
    users: [{ email: "daniel@cactusridge.example", name: "Daniel Okafor", role: "BROKER_ADMIN", nmlsId: "977415", title: "Branch Manager", phone: "(555) 010-7731", slug: "daniel" }],
  },
  {
    slug: "evergreen-key",
    companyName: "Evergreen Key Capital",
    companyNmlsId: "2390551",
    accentColor: "#8FBF9F",
    logoUrl: monogramSvg("EK", "#2F6B4F", "#E9F2E6", "circle"),
    email: "team@evergreenkey.example",
    phone: "(555) 010-5518",
    websiteUrl: "https://evergreenkey.example",
    privacyPolicyUrl: "https://evergreenkey.example/privacy",
    licensedStates: ["WA", "OR", "ID"],
    tonePreset: "CONSULTATIVE",
    marketRateMilli: 6_500,
    status: "TRIAL",
    programGrid: grid((g) => {
      g.baseRateMilli = 7_000;
      g.ficoFloor = 680;
      g.strongDscrRatio = 12_500;
    }),
    users: [{ email: "priya@evergreenkey.example", name: "Priya Raman", role: "BROKER_ADMIN", nmlsId: "2051876", title: "Investor Lending Specialist", phone: "(555) 010-5518", slug: "priya" }],
  },
];
