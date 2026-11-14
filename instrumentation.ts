/**
 * On serverless hosts (Netlify Functions / AWS Lambda) an unhandled promise rejection ends the whole
 * function ("This function has crashed"). Log it instead, so the request still completes and the
 * error shows up in the function log.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __dscrGuards?: boolean };
  if (g.__dscrGuards) return;
  g.__dscrGuards = true;
  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason instanceof Error ? reason.stack : reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err.stack ?? err);
  });
}
