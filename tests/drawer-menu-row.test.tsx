/**
 * Test unit DrawerMenuRow — mengunci kontrak presentasi baris menu drawer:
 * judul memakai bodyLarge weight 600 (seperti menu Pengaturan), ikon Phosphor varian bold, tepat satu
 * ikon per baris (tanpa chevron, tanpa background ikon).
 *
 * `Text` di-mock agar prop weight teramati: di env test ini className
 * nativewind pada primitif RN tidak diteruskan ke DOM (plugin Babel
 * nativewind tidak berjalan di Vitest), jadi weight tidak bisa dibaca dari
 * computed style — kontrak yang dikunci adalah prop yang dikirim drawer.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Href } from "expo-router"
import { Wallet } from "phosphor-react-native"

import { ThemeProvider } from "@/components/theme-provider"
import { DrawerMenuRow } from "@/components/ui/app-drawer"

vi.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react")
  return {
    Text: ({ children, weight }: { children?: React.ReactNode; weight?: number }) =>
      React.createElement(
        "span",
        { "data-text-weight": weight ?? "default" },
        children,
      ),
  }
})

afterEach(() => {
  cleanup()
})

describe("DrawerMenuRow", () => {
  it("judul bodyLarge weight 600, ikon bold, tepat satu ikon tanpa chevron", () => {
    const onNavigate = vi.fn()
    render(
      <ThemeProvider>
        <DrawerMenuRow
          item={{
            id: "wallet",
            label: "Dompet",
            icon: Wallet,
            href: "/wallet" as Href,
            accessibilityLabel: "Buka dompet",
          }}
          onNavigate={onNavigate}
        />
      </ThemeProvider>,
    )

    const row = screen.getByRole("menuitem", { name: "Buka dompet" })

    const title = row.querySelector("[data-text-weight]")
    expect(title?.textContent).toBe("Dompet")
    expect(title?.getAttribute("data-text-weight")).toBe("600")

    const icons = row.querySelectorAll("[data-icon]")
    expect(icons.length).toBe(1)
    expect(icons[0]!.getAttribute("data-icon")).toBe("Wallet")
    expect(icons[0]!.getAttribute("data-weight")).toBe("bold")
  })
})
