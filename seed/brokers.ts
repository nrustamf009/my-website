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

export const DEMO_BROKERS = [
  {
    slug: "harborline",
    name: "Maya Castellano",
    title: "Senior Loan Officer",
    companyName: "Harborline Lending",
    nmlsId: "1849302",
    companyNmlsId: "2203117",
    accentColor: "#1F4E79",
    logoUrl: monogramSvg("HL", "#1F4E79", "#F2D27C", "square"),
    email: "maya@harborline.example",
    phone: "(555) 010-2240",
    website: "https://harborline.example",
    licensedStates: "TX, FL, GA, NC",
    messageTone: "Warm and friendly, conversational, like texting a client you know. Short sentences.",
    defaultRate: 7.25,
    marketRate: 6.625,
    taxRatePct: 1.6,
    insuranceRatePct: 0.6,
    login: "maya@harborline.example",
  },
  {
    slug: "cactus-ridge",
    name: "Daniel Okafor",
    title: "Branch Manager",
    companyName: "Cactus Ridge Mortgage",
    nmlsId: "977415",
    companyNmlsId: "1650228",
    accentColor: "#B4532A",
    logoUrl: monogramSvg("CR", "#B4532A", "#FFF4E8", "arch"),
    email: "daniel@cactusridge.example",
    phone: "(555) 010-7731",
    website: "https://cactusridge.example",
    licensedStates: "AZ, NV, NM, UT",
    messageTone: "Direct and numbers-first. Professional, confident, no fluff.",
    defaultRate: 7.375,
    marketRate: 6.75,
    taxRatePct: 0.7,
    insuranceRatePct: 0.55,
    login: "daniel@cactusridge.example",
  },
  {
    slug: "evergreen-key",
    name: "Priya Raman",
    title: "Investor Lending Specialist",
    companyName: "Evergreen Key Capital",
    nmlsId: "2051876",
    companyNmlsId: null,
    accentColor: "#2F6B4F",
    logoUrl: monogramSvg("EK", "#2F6B4F", "#E9F2E6", "circle"),
    email: "priya@evergreenkey.example",
    phone: "(555) 010-5518",
    website: "https://evergreenkey.example",
    licensedStates: "WA, OR, ID",
    messageTone: "Polished and consultative. Educational, calm, and reassuring.",
    defaultRate: 7.125,
    marketRate: 6.5,
    taxRatePct: 1.0,
    insuranceRatePct: 0.45,
    login: "priya@evergreenkey.example",
  },
] as const;
