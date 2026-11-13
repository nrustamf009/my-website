import type { Broker } from "@prisma/client";
import { DEFAULT_CONTEXT, normalizeGrid, type EngineContext } from "../lib/dscr";
export { analyzeDeal } from "../lib/dscr";

export function engineContextFromGrid(broker: Broker): EngineContext {
  return { ...DEFAULT_CONTEXT, grid: normalizeGrid(JSON.parse(broker.programGrid || "null")) };
}
