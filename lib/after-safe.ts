import { after } from "next/server";
import { log } from "@/lib/log";

/**
 * after() whose failures are logged, never thrown. On AWS Lambda (Netlify Functions) a rejected
 * background task ends the whole invocation, so the visitor sees "function crashed" even though
 * their request succeeded.
 */
export function afterSafe(task: () => unknown, label: string) {
  after(async () => {
    try {
      await task();
    } catch (err) {
      log.error(`after.${label}_failed`, err);
    }
  });
}
