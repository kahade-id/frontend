/**
 * <ProfileLinks> — tautan sosial di profil publik (bug "link tidak muncul").
 *
 *  - compact: maks 3 chip + "+N" yang memanggil onMore (buka tab Tentang).
 *  - penuh (tab Tentang): semua tautan tampil dengan domain.
 *  - ketuk → dialog konfirmasi berisi domain + URL (tidak langsung membuka).
 *  - tanpa tautan → tidak merender apa pun.
 *
 * Dijalankan dengan config komponen:
 *   npx vitest run --config vitest.components.config.ts tests/profile-links-render.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { ProfileLinks } from "@/components/ui/profile-links"
import type { ProfileLink } from "@/lib/profile-links"

afterEach(cleanup)

function renderThemed(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>{ui}</ToastProvider>
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

const LINKS: ProfileLink[] = [
  { platform: "instagram", url: "https://instagram.com/budi", label: "IG Budi", displayOrder: 0 },
  { platform: "website", url: "https://www.tokobudi.id/katalog", label: null, displayOrder: 1 },
  { platform: "tiktok", url: "https://tiktok.com/@budi", label: null, displayOrder: 2 },
  { platform: "whatsapp", url: "https://wa.me/628123", label: null, displayOrder: 3 },
]

describe("ProfileLinks — compact", () => {
  it("menampilkan maks 3 tautan + chip +N yang membuka 'lainnya'", () => {
    const onMore = vi.fn()
    renderThemed(<ProfileLinks links={LINKS} compact onMore={onMore} />)
    expect(screen.getByText("IG Budi")).toBeTruthy()
    expect(screen.getByText("tokobudi.id")).toBeTruthy()
    expect(screen.getByText("tiktok.com")).toBeTruthy()
    expect(screen.queryByText("wa.me")).toBeNull()
    fireEvent.click(screen.getByText("+1"))
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it("tidak merender apa pun bila tidak ada tautan", () => {
    const { container } = renderThemed(<ProfileLinks links={[]} compact />)
    expect(container.textContent).toBe("")
  })

  it("ketuk tautan → dialog konfirmasi dengan domain + URL (tidak langsung membuka)", () => {
    renderThemed(<ProfileLinks links={LINKS} compact />)
    fireEvent.click(screen.getByText("IG Budi"))
    expect(screen.getByText("Buka tautan luar?")).toBeTruthy()
    expect(screen.getByText("instagram.com")).toBeTruthy()
    expect(screen.getByText("https://instagram.com/budi")).toBeTruthy()
  })
})

describe("ProfileLinks — daftar penuh (tab Tentang)", () => {
  it("menampilkan semua tautan dengan judul kartu 'Tautan'", () => {
    renderThemed(<ProfileLinks links={LINKS} />)
    expect(screen.getByText("Tautan")).toBeTruthy()
    expect(screen.getByText("IG Budi")).toBeTruthy()
    // Label ≠ domain → domain tampil sebagai caption di bawahnya.
    expect(screen.getByText("instagram.com")).toBeTruthy()
    expect(screen.getByText("wa.me")).toBeTruthy()
  })
})
