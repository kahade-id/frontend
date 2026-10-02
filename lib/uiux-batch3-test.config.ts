/**
 * Run: npx vitest run --config lib/uiux-batch3-test.config.ts
 * Tests live under lib/components to respect this batch's strict file allowlist.
 */
import { defineConfig } from "vitest/config"
import componentConfig from "../vitest.components.config"

export default defineConfig({
  ...componentConfig,
  test: {
    environment: "jsdom",
    include: ["lib/__tests__/uiux-batch3*.test.ts", "components/__tests__/uiux-batch3*.test.tsx"],
  },
})
