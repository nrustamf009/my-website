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

function findMoney(text: string, keywords: RegExp, requireDollar = false): number | null {
  const re = new RegExp(`(?:${keywords.source})[^$\\d]{0,40}\\$${requireDollar ? "" : "?"}\\s?([\\d,.]+\\s?[km]?)`, "i");
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
    // Ignore the loan officer's own lines when looking for the investor's name.
    const investorText = t
      .split("\n")
      .filter((l) => !/^\s*(broker|loan officer|lo|me)\s*:/i.test(l))
      .join("\n");
    const name = investorText.match(/(?:this is|my name is|i'm|name's|call with|spoke with|met with)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? null;
    const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
    const phone = t.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? null;
    const address = t.match(/\d{2,6}\s+[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Trail|Trl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Loop|Run|Pass)\b[^.\n]*?(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)?(?:,\s*[A-Z]{2})?(?:\s\d{5})?/)?.[0] ?? null;
    const price = findMoney(t, /purchase price|price is|under contract (?:at|for)|asking|offer(?:ed)? (?:at|of)|worth|valued? (?:at)?|paying/);
    const rent = findMoney(t, /\b(?:rent|rents|lease)\b/, true);
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
    // Check the 5-year structure first: "3-2-1" is a substring of "5-4-3-2-1".
    const prefersPrepay = lower.match(/prefer[^.\n]{0,30}?(5-4-3-2-1|3-2-1|no prepay)/)?.[1];
    const prepay =
      prefersPrepay === "5-4-3-2-1" || (!prefersPrepay && /5-4-3-2-1|five year prepay/.test(lower))
        ? "5-4-3-2-1"
        : prefersPrepay === "no prepay" || (!prefersPrepay && /no prepay|without (?:a )?prepay/.test(lower))
          ? "NONE"
          : prefersPrepay === "3-2-1" || /3-2-1|three year prepay|3 year prepay/.test(lower)
            ? "3-2-1"
            : null;
    const io = /(not sure about|don't want|no|avoid|risky)[^.\n]{0,20}interest[- ]only|interest[- ]only[^.\n]{0,30}(risky|not for me)/.test(lower)
      ? false
      : /interest[- ]only/.test(lower)
        ? true
        : null;
    const taxes = findMoney(t, /taxes (?:are|run|about)?/);
    const insurance = findMoney(t, /insurance (?:is|runs|about)?/);
    const hoa = findMoney(t, /hoa (?:is|of|about)?/);

    const goals = sentencesWith(t, /\b(wants?|goals?|looking to|hoping|plans? to|cash flow|grow|pull (?:cash|equity))\b/i);
    const objections = sentencesWith(t, /\b(worried|concern|too high|expensive|not sure|hesitant|but the rate|penalty|don't like)\b/i);
    const nextSteps = sentencesWith(t, /\b(send|will get|next step|follow up|by (?:monday|tuesday|wednesday|thursday|friday)|tomorrow|this week)\b/i);

    const missing: string[] = [];
    if (!address) missing.push("Property address");
    if (!price) missing.push("Purchase price or value");
    if (!rent) missing.push("Monthly rent");
    if (!ficoRange) missing.push("Credit score range");

    return {
      summary: `${name ?? "The investor"} is looking at a ${loanPurpose === "CASH_OUT" ? "cash-out refinance" : loanPurpose === "RATE_TERM" ? "rate-and-term refinance" : "purchase"}${address ? ` on ${address}` : ""}${price ? ` around $${Math.round(price).toLocaleString("en-US")}` : ""}. (Mock AI extraction: review every field.)`,
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
      `Thanks for taking the time to talk${ctx.propertyAddress ? ` about ${ctx.propertyAddress}` : " about your next investment"}. I enjoyed hearing about your plans, and I think we can find a structure that fits.`,
      "",
      ctx.scenarioUrl ? `I put together a few loan options for you to compare:\n${ctx.scenarioUrl}\n` : "I'll send over a few loan options to compare shortly.\n",
      "To keep things moving, here is what the lender will ask for:",
      ...ctx.checklist.map((c) => `- ${c}`),
      "",
      "I'll keep an eye out for those and follow up in a couple of days.",
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
