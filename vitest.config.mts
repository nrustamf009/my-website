import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { include: ["lib/**/*.test.ts", "src/**/*.test.ts", "tests/unit/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@design": fileURLToPath(new URL("./src/design", import.meta.url)), "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
