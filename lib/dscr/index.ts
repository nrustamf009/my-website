/** lib/dscr: the only place financial math lives. Pure, framework-free, deterministic. */
export * from "./units";
export * from "./types";
export * from "./amortization";
export * from "./prepay";
export * from "./grid";
export * from "./analyze";
export * from "./scenario";
export * from "./money-list";
export * from "./data/state-defaults";

import { DEFAULT_GRID } from "./grid";
import { STATE_DEFAULTS } from "./data/state-defaults";
import type { EngineContext } from "./analyze";

export const DEFAULT_CONTEXT: EngineContext = { grid: DEFAULT_GRID, stateDefaults: STATE_DEFAULTS };
export * from "./snapshot";
