import { CASH_OUT_ASSUMPTIONS } from "./defaults";
import { monthlyPI, remainingBalance } from "./payment";

/**
 * Rate-and-term refinance estimate. Compares the current P&I with a new 30-year loan
 * on the estimated remaining balance at the market rate.
 */
export function rateDropSavings(params: {
  originalLoan: number;
  currentRatePct: number;
  marketRatePct: number;
  monthsPaid: number;
  interestOnly: boolean;
  penaltyPct: number;
}) {
  const { originalLoan, currentRatePct, marketRatePct, monthsPaid, interestOnly, penaltyPct } = params;
  const balance = remainingBalance({ loanAmount: originalLoan, ratePct: currentRatePct, interestOnly, monthsPaid });
  const currentPI = monthlyPI({ loanAmount: originalLoan, ratePct: currentRatePct, interestOnly });
  const newPI = monthlyPI({ loanAmount: balance, ratePct: marketRatePct, interestOnly });
  const monthlySavings = Math.max(0, currentPI - newPI);
  const penaltyCost = (balance * penaltyPct) / 100;
  const breakevenMonths = monthlySavings > 0 ? penaltyCost / monthlySavings : null;
  return { balance, currentPI, newPI, monthlySavings, annualSavings: monthlySavings * 12, penaltyCost, breakevenMonths };
}

/** Estimated cash-out available, using conservative documented assumptions. */
export function cashOutEstimate(params: {
  originalLoan: number;
  ratePct: number;
  monthsPaid: number;
  interestOnly: boolean;
  assumptions?: typeof CASH_OUT_ASSUMPTIONS;
}) {
  const a = params.assumptions ?? CASH_OUT_ASSUMPTIONS;
  const originalValue = params.originalLoan / a.originalLtv;
  const estimatedValue = originalValue * Math.pow(1 + a.appreciationPct / 100, params.monthsPaid / 12);
  const balance = remainingBalance({ loanAmount: params.originalLoan, ratePct: params.ratePct, interestOnly: params.interestOnly, monthsPaid: params.monthsPaid });
  const availableCash = Math.max(0, estimatedValue * a.cashOutLtv - balance);
  return { estimatedValue, balance, availableCash };
}
