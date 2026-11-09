import type { AiClient, CallExtraction, FollowUpContext, FollowUpEmail, OutreachContext } from "./types";

const FICO_BUCKETS: Array<[number, CallExtraction["deal"]["ficoRange"]]> = [
  [760, "760+"],
  [720, "720-759"],
  [680, "680-719"],
  [660, "660-679"],
  [620, "620-659"],
  [0, "<620"],
];

function money(raw: string): number {
  const s = raw.toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^([\d.]+)(k|m)?/);
  if (!m) return NaN;
  const n = parseFloat(m[1]!);
  return m[2] === "k" ? n * 1000 : m[2] === "m" ? n * 1_000_000 : n;
}

function findMoney(text: string, keywords: RegExp): number | null {
  const re = new RegExp(`(?:${keywords.source})[^$\\d]{0,40}\\$?\\s?([\\d,.]+\\s?[km]?)`, "i");
  const m = text.match(re);
  if (!m) return null;
  const v = money(m[1]!);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function sentencesWith(text: string, words: RegExp, max = 3): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[A-Za-z ]{1,20}:\s*/, "").trim())
    .filter((s) => s.length > 12 && s.length < 220 && words.test(s))
    .slice(0, max);
}

/** Rule-based stand-in for Claude so the full flow works without an API key. */
export class MockAi implements AiClient {
  readonly mode = "mock" as const;

  async extractCall(transcript: string): Promise<CallExtraction> {
    const t = transcript;
    const name = t.match(/(?:this is|my name is|i'm|name's)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? null;
    const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
    const phone = t.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? null;
    const address = t.match(/\d{2,6}\s+[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Trail|Terrace)\b[^.\n]*?(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)?(?:,\s*[A-Z]{2})?(?:\s\d{5})?/)?.[0] ?? null;
    const price = findMoney(t, /purchase price|price is|under contract (?:at|for)|asking|offer(?:ed)? (?:at|of)|worth|valued? (?:at)?|paying/);
    const rent = findMoney(t, /rent(?:s)?(?: is| for| at| around| about)?|lease(?:d)? (?:for|at)/);
    const downMatch = t.match(/(\d{1,2})\s?(?:%|percent)\s?down/i);
    const ficoMatch = t.match(/(?:credit|fico|score)[^\d]{0,25}(\d{3})/i);
    const fico = ficoMatch ? parseInt(ficoMatch[1]!, 10) : null;
    const ficoRange = fico ? FICO_BUCKETS.find(([min]) => fico >= min)![1] : null;
    const lower = t.toLowerCase();
    const loanPurpose = /cash[- ]out|pull (?:some )?(?:cash|equity)/.test(lower)
      ? "CASH_OUT"
      : /refi|refinanc/.test(lower)
        ? "RATE_TERM"
        : /purchase|buy|under contract|offer/.test(lower)
          ? "PURCHASE"
          : null;
    const prepay = /no prepay|without (?:a )?prepay/.test(lower) ? "NONE" : /3-2-1|three year prepay|3 year prepay/.test(lower) ? "3-2-1" : /5-4-3-2-1|five year prepay/.test(lower) ? "5-4-3-2-1" : null;
    const io = /interest[- ]only/.test(lower) ? true : null;
    const taxes = findMoney(t, /taxes (?:are|run|about)?/);
    const insurance = findMoney(t, /insurance (?:is|runs|about)?/);
    const hoa = findMoney(t, /hoa (?:is|of|about)?/);

    const goals = sentencesWith(t, /\b(want|goal|looking to|hoping|plan to|need to|cash flow|grow)\b/i);
    const objections = sentencesWith(t, /\b(worried|concern|too high|expensive|not sure|hesitant|but the rate|penalty|don't like)\b/i);
    const nextSteps = sentencesWith(t, /\b(send|will get|next step|follow up|by (?:monday|tuesday|wednesday|thursday|friday)|tomorrow|this week)\b/i);

    const missing: string[] = [];
    if (!address) missing.push("Property address");
    if (!price) missing.push("Purchase price or value");
    if (!rent) missing.push("Monthly rent");
    if (!ficoRange) missing.push("Credit score range");

    return {
      summary: `${name ?? "The investor"} discussed a ${loanPurpose === "CASH_OUT" ? "cash-out refinance" : loanPurpose === "RATE_TERM" ? "rate-and-term refinance" : "purchase"}${address ? ` for ${address}` : ""}${price ? ` around $${Math.round(price).toLocaleString("en-US")}` : ""}. (Mock AI extraction: review every field.)`,
      investor: { name, email, phone, experience: lower.match(/(own|have)\s+(\w+)\s+(rentals|doors|properties|units)/)?.[0] ?? null },
      deal: {
        propertyAddress: address,
        loanPurpose,
        purchasePrice: price,
        loanAmount: null,
        downPaymentPct: downMatch ? parseInt(downMatch[1]!, 10) / 100 : null,
        monthlyRent: rent,
        ficoRange,
        propertyType: /duplex|triplex|fourplex|quad|2-4/.test(lower) ? "Multi-family (2-4)" : /condo/.test(lower) ? "Condo" : /single[- ]family|house/.test(lower) ? "Single family" : null,
        units: /duplex/.test(lower) ? 2 : /triplex/.test(lower) ? 3 : /fourplex|quad/.test(lower) ? 4 : null,
        wantsInterestOnly: io,
        prepayPreference: prepay,
        targetRatePct: null,
        taxesMonthly: taxes,
        insuranceMonthly: insurance,
        hoaMonthly: hoa,
      },
      goals: goals.length ? goals : ["Finance the property with a DSCR loan"],
      objections,
      nextSteps: nextSteps.length ? nextSteps : ["Send scenario options", "Collect documents"],
      missingInfo: missing,
    };
  }

  async draftOutreach(ctx: OutreachContext, tone: string): Promise<string> {
    const casual = /casual|friendly|warm/i.test(tone);
    const first = ctx.brokerName.split(" ")[0];
    return [
      `${casual ? "Hi" : "Hello"} ${ctx.borrowerFirstName},`,
      "",
      `I was reviewing your loan on ${ctx.propertyAddress} and wanted to reach out. ${ctx.reasons.join(" Also, ")}.`,
      "",
      `Based on today's market, ${ctx.benefit.charAt(0).toLowerCase() + ctx.benefit.slice(1)}. These are estimates, and I'd want to confirm the numbers with you.`,
      "",
      `${casual ? "Do you have 10 minutes this week for a quick call?" : "Would you be open to a brief call this week to review your options?"}`,
      "",
      first,
    ].join("\n");
  }

  async draftFollowUpEmail(ctx: FollowUpContext, tone: string): Promise<FollowUpEmail> {
    const casual = /casual|friendly|warm/i.test(tone);
    const body = [
      `${casual ? "Hi" : "Hello"} ${ctx.investorFirstName},`,
      "",
      `Thanks for taking the time to talk${ctx.propertyAddress ? ` about ${ctx.propertyAddress}` : ""}. ${ctx.summary.replace(/\s*\(Mock AI.*\)$/, "")}`,
      "",
      ctx.scenarioUrl ? `I put together a few loan options for you to compare:\n${ctx.scenarioUrl}\n` : "I'll send over a few loan options to compare shortly.\n",
      "To keep things moving, here is what I'll need:",
      ...ctx.checklist.map((c) => `- ${c}`),
      "",
      ctx.nextSteps.length ? `Next steps: ${ctx.nextSteps.join("; ")}.` : "",
      "",
      "Any questions at all, just reply here or give me a call.",
      "",
      `${ctx.brokerName}`,
      `${ctx.companyName}${ctx.brokerPhone ? ` · ${ctx.brokerPhone}` : ""}`,
    ]
      .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
      .join("\n");
    return { subject: `Next steps${ctx.propertyAddress ? ` for ${ctx.propertyAddress.split(",")[0]}` : " on your DSCR loan"}`, body };
  }
}
