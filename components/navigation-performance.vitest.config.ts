// Scoped tests live under components/ to respect the OTA-only change boundary.
import { defineConfig } from "vitest/config"
import componentConfig from "../vitest.components.config"

export default defineConfig({
  ...componentConfig,
  test: { ...componentConfig.test, include: ["components/__tests__/navigation-performance.test.tsx"] },
})
