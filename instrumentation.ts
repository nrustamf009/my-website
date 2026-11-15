import type { Instrumentation } from "next";

/**
 * On serverless hosts (Netlify Functions / AWS Lambda) an unhandled promise rejection ends the whole
 * function ("This function has crashed"). Log it instead, so the request still completes and the
 * error shows up in the function log and in /api/health?errors=1.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __dscrGuards?: boolean };
  if (g.__dscrGuards) return;
  g.__dscrGuards = true;
  const { log } = await import("@/lib/log");
  process.on("unhandledRejection", (reason) => log.error("process.unhandled_rejection", reason));
  process.on("uncaughtException", (err) => log.error("process.uncaught_exception", err));
}

/** Every server render / route / action error, with its digest, so the error page can show the cause. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("@/lib/log");
  const e = err as Error & { digest?: string };
  log.error("request.failed", e, { digest: e.digest ?? null, path: request.path.split("?")[0], method: request.method, kind: context.routeType, stack: (e.stack ?? "").split("\n").slice(1, 4).join(" | ") });
};
