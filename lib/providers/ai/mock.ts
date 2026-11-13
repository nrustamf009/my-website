import type { AiClient, FollowUpFacts, NotesExtraction, OutreachFacts } from "./types";

function money(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^([\d.]+)(k|m)?/);
  if (!m) return null;
  const n = parseFloat(m[1]!) * (m[2] === "k" ? 1000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findMoney(text: string, keywords: RegExp, requireDollar = false): number | null {
  const re = new RegExp(`(?:${keywords.source})[^$\\d]{0,40}\\$${requireDollar ? "" : "?"}\\s?([\\d,.]+\\s?[km]?)`, "i");
  const m = text.match(re);
  return m ? money(m[1]!) : null;
}

function sentences(text: string, words: RegExp, max = 3): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[A-Za-z ]{1,20}:\s*/, "").trim())
    .filter((s) => s.length > 12 && s.length < 220 && words.test(s))
    .slice(0, max);
}

/** Rule-based stand-in for Claude so every flow works without an API key. Never invents numbers. */
export class MockAi implements AiClient {
  readonly mode = "mock" as const;

  async extractNotes(t: string): Promise<NotesExtraction> {
    const lower = t.toLowerCase();
    const investorText = t.split("\n").filter((l) => !/^\s*(broker|loan officer|lo|me)\s*:/i.test(l)).join("\n");
    const name = investorText.match(/(?:this is|my name is|i'm|name's|call with|spoke with|met with)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? null;
    const address = t.match(/\d{2,6}\s+[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Trail|Trl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Loop|Run|Pass)\b[^.\n]*?(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)?(?:,\s*[A-Z]{2})?(?:\s\d{5})?/)?.[0] ?? null;
    const state = address?.match(/,\s*([A-Z]{2})(?:\s\d{5})?$/)?.[1] ?? null;
    const fico = Number(t.match(/(?:credit|fico|score)[^\d]{0,25}(\d{3})/i)?.[1]) || null;
    const purpose = /cash[- ]out|pull (?:some )?(?:cash|equity)/.test(lower) ? "CASH_OUT" : /refi|refinanc/.test(lower) ? "RATE_TERM" : /purchase|buy|under contract|offer/.test(lower) ? "PURCHASE" : null;
    const prefers = lower.match(/prefer[^.\n]{0,30}?(5-4-3-2-1|3-2-1|no prepay)/)?.[1];
    const prepay = prefers === "5-4-3-2-1" || (!prefers && /5-4-3-2-1/.test(lower)) ? "5-4-3-2-1" : prefers === "no prepay" || (!prefers && /no prepay/.test(lower)) ? "NONE" : prefers === "3-2-1" || /3-2-1/.test(lower) ? "3-2-1" : null;
    const ioNo = /(not sure about|don't want|avoid|risky)[^.\n]{0,20}interest[- ]only|interest[- ]only[^.\n]{0,30}risky/.test(lower);
    const units = /duplex/.test(lower) ? 2 : /triplex/.test(lower) ? 3 : /fourplex|quad/.test(lower) ? 4 : null;
    const missing: string[] = [];
    const price = findMoney(t, /purchase price|price is|under contract (?:at|for)|worth|valued? (?:at)?|paying/);
    const rent = findMoney(t, /\b(?:rent|rents|lease)\b/, true);
    if (!address) missing.push("Property address");
    if (!price) missing.push("Purchase price or value");
    if (!rent) missing.push("Monthly rent");
    if (!fico) missing.push("Credit score range");
    const months = t.match(/(?:bought|purchased|owned)[^.\n]{0,20}?(\d{1,3})\s+months/i)?.[1] ?? t.match(/(\d{1,3})\s+months ago/i)?.[1];
    return {
      summary: `${name ?? "The investor"} is looking at a ${purpose === "CASH_OUT" ? "cash-out refinance" : purpose === "RATE_TERM" ? "rate-and-term refinance" : "purchase"}${address ? ` on ${address}` : ""}. (Auto-extracted: please review every field.)`,
      investor: {
        name,
        email: t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null,
        phone: t.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? null,
        experience: lower.match(/(own|have)\s+(\w+)\s+(rentals|doors|properties|units)/)?.[0] ?? null,
      },
      deal: {
        propertyAddress: address,
        state,
        loanPurpose: purpose,
        propertyType: units ? "2-4" : /condo/.test(lower) ? "CONDO" : /townhome|townhouse/.test(lower) ? "TOWNHOME" : /single[- ]family|house/.test(lower) ? "SFR" : null,
        units,
        use: /airbnb|vrbo|short[- ]term/.test(lower) ? "STR" : /lease|tenant|long[- ]term/.test(lower) ? "LTR" : null,
        priceOrValueDollars: price,
        currentBalanceDollars: findMoney(t, /(?:owe|balance(?: is)?|loan balance)/),
        cashOutDollars: findMoney(t, /(?:pull out|cash[- ]out of|take out)/),
        downPaymentPercent: Number(t.match(/(\d{1,2})\s?(?:%|percent)\s?down/i)?.[1]) || null,
        monthlyRentDollars: rent,
        taxesMonthlyDollars: findMoney(t, /taxes (?:are|run|about)?/),
        insuranceMonthlyDollars: findMoney(t, /insurance (?:is|runs|about)?/),
        hoaMonthlyDollars: findMoney(t, /hoa (?:is|of|about)?/),
        ficoScore: fico,
        wantsInterestOnly: ioNo ? false : /interest[- ]only/.test(lower) ? true : null,
        prepayPreference: prepay,
        monthsOwned: months ? Number(months) : null,
      },
      entity: /\bllc\b|my company|entity/.test(lower) ? "LLC" : /personal name|my name on title/.test(lower) ? "PERSONAL" : null,
      timeline: t.match(/(?:closing|close)[^.\n]{0,30}(?:weeks?|days?|month)/i)?.[0] ?? null,
      goals: sentences(t, /\b(wants?|goals?|looking to|hoping|plans? to|cash flow|grow|pull (?:cash|equity))\b/i).length ? sentences(t, /\b(wants?|goals?|looking to|hoping|plans? to|cash flow|grow|pull (?:cash|equity))\b/i) : ["Finance the property with a DSCR loan"],
      objections: sentences(t, /\b(worried|concern|too high|expensive|not sure|hesitant|penalty|don't like)\b/i),
      nextSteps: sentences(t, /\b(send|will get|next step|follow up|by (?:monday|tuesday|wednesday|thursday|friday)|tomorrow|this week)\b/i),
      missingInfo: missing,
    };
  }

  async draftOutreach(f: OutreachFacts, tone: string) {
    const casual = /friendly|warm|casual/i.test(tone);
    const why = f.reasons.join(" Also, ").replace(/\.$/, "");
    const benefit = f.benefit ? ` Based on today's market, ${f.benefit.charAt(0).toLowerCase()}${f.benefit.slice(1)}${f.netOf ? ` (${f.netOf})` : ""}, as an estimate.` : "";
    return {
      emailSubject: `Quick idea for ${f.propertyAddress.split(",")[0]}`,
      emailBody: `${casual ? "Hi" : "Hello"} ${f.borrowerFirstName},\n\nI was reviewing your loan on ${f.propertyAddress}. ${why}.${benefit}\n\n${casual ? "Got 10 minutes this week for a quick call?" : "Would you be open to a brief call this week to review options?"}`,
      sms: `${casual ? "Hi" : "Hello"} ${f.borrowerFirstName}, it's ${f.loName.split(" ")[0]} from ${f.companyName}. ${f.reasons[0]?.replace(/\.$/, "")} on ${f.propertyAddress.split(",")[0]}.${f.benefit ? ` ${f.benefit} (estimate).` : ""} Worth a quick call?`,
    };
  }

  async draftFollowUp(f: FollowUpFacts, tone: string) {
    const casual = /friendly|warm|casual/i.test(tone);
    const body = [
      `${casual ? "Hi" : "Hello"} ${f.investorFirstName},`,
      "",
      `Thanks for taking the time to talk${f.propertyAddress ? ` about ${f.propertyAddress}` : ""}. I enjoyed hearing about your plans and think we can find a structure that fits.`,
      "",
      f.scenarioUrl ? `I put together a few loan options to compare:\n${f.scenarioUrl}\n` : "I'll send a few loan options to compare shortly.\n",
      "To keep things moving, here's what the lender will ask for:",
      ...f.checklist.map((c) => `- ${c}`),
      "",
      "I'll follow up in a couple of days. Any questions, just reply here.",
    ].join("\n");
    return { subject: `Next steps${f.propertyAddress ? ` for ${f.propertyAddress.split(",")[0]}` : " on your DSCR loan"}`, body };
  }
}
