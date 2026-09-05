import { defineConfig } from "vitest/config"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  define: { __DEV__: true },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: false,
    restoreMocks: true,
    clearMocks: true,
  },
})
