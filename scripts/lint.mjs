#!/usr/bin/env node
/**
 * Project guard rails (no extra dependencies). Fails CI when:
 *  1. a banned word appears in UI/PDF/email/AI-draft code or strings,
 *  2. money math happens outside lib/dscr (formatting and boundary parsing are allowed),
 *  3. tenant models are queried through the raw Prisma client instead of forBroker(),
 *  4. a "use server" module exports something other than async functions and types.
 * Run: npm run lint   (CLAUDE.md non-negotiables; see docs/ARCHITECTURE.md)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = ["app", "components", "lib"];
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(relative(ROOT, p));
  }
};
SRC.forEach((d) => walk(join(ROOT, d)));

const problems = [];
const report = (file, line, rule, text) => problems.push(`${file}:${line}  [${rule}]  ${text.trim().slice(0, 140)}`);
const codeLines = (src) =>
  src.split("\n").map((l, i) => ({ n: i + 1, l, comment: /^\s*(\/\/|\*|\/\*)/.test(l) }));

// 1. Banned words (the required disclaimer negation "not a commitment to lend" is allowed).
const BANNED = /\b(pre-?approved|pre-?approval|approved|pre-?qualified|pre-?qualify|prequalif\w*|qualifies|guaranteed|guarantee|commitment)\b/i;
const BANNED_EXEMPT = ["lib/compliance/", "lib/providers/ai/prompts.ts", "lib/providers/ai/guard.ts"];
const NEGATION = /not (?:a |an offer or (?:a )?)?commitment to lend/gi;

// 2. Money math outside the engine.
const MATH = /(?:\b\w*(?:Cents|Milli|Ratio)\b\s*[-+*/]\s*[\w(]|[-+*/]\s*[\w.!?]*(?:Cents|Milli|Ratio)\b|\*\s*12\b|\b10_000\s*-|\/\s*100\b|\*\s*100\b)/;
const MATH_EXEMPT = ["lib/dscr/", "lib/format.ts", "lib/providers/", "lib/moneylist/csv.ts", "lib/actions/settings.ts"];
const MATH_OK_LINE = /\b(points|usd|usdMagnitude|pct|rate|dscr)\(\s*-?\w/; // sign flips inside formatters

// 3. Raw prisma on tenant models.
const TENANT = /\bprisma\.(lead|consent|event|scenario|scenarioOption|scenarioView|realtor|snapshot|loanImport|closedLoan|loanStatusChange|savedNote|webhookDelivery|disclaimerVersion)\b/;
const TENANT_EXEMPT = ["lib/db/"];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = codeLines(src);
  if (!BANNED_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && BANNED.test(l.replace(NEGATION, "")) && !/BANNED_WORDS/.test(l)) report(f, n, "banned-word", l);
  if (!MATH_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && MATH.test(l) && !MATH_OK_LINE.test(l.match(MATH)?.input.slice(Math.max(0, l.search(MATH) - 20), l.search(MATH) + 5) ?? "")) report(f, n, "money-math", l);
  if (!TENANT_EXEMPT.some((x) => f.startsWith(x)))
    for (const { n, l, comment } of lines) if (!comment && TENANT.test(l)) report(f, n, "raw-prisma", l);
  if (/^["']use server["'];?/m.test(src.split("\n").slice(0, 3).join("\n")))
    for (const { n, l } of lines) if (/^export\s+(const|let|var|class|default\s+(?!async))/.test(l)) report(f, n, "use-server-export", l);
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`✓ guards passed (${files.length} files): banned words, money math in lib/dscr only, tenant scoping, server actions`);
