/**
 * Kahade — `goBackOrNavigate`: navigasi balik yang tidak boleh berujung buntu.
 *
 * Sengaja berupa uji unit murni (tanpa render): yang dipakai adalah objek
 * navigator palsu, jadi tidak ada ketergantungan pada native/phosphor/
 * nativewind. Kegagalan yang dijaga di sini adalah yang paling sulit
 * direproduksi manual — layar yang dibuka lewat deep link atau tab baru
 * tidak punya entri riwayat, sehingga `router.back()` diam-diam tidak
 * melakukan apa-apa dan pengguna terjebak tepat setelah aksi berhasil.
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest"

// `expo-router` mengekspor layout TSX yang tidak bisa ditransform di vitest,
// jadi modul aslinya diganti seluruhnya. Helper hanya menyentuh singleton
// `router` bila pemanggil tidak meneruskan navigator sendiri.
vi.mock("expo-router", () => ({
  router: { canGoBack: () => true, back: () => {}, replace: () => {} },
}))

// `lib/navigation.ts` juga mengekspor `useComingSoon()` yang menarik
// <ToastProvider> → nativewind/phosphor; rantai modul itu tidak bisa
// ditransform di vitest, jadi cukup diganti. `goBackOrNavigate` sendiri
// tidak menyentuh toast sama sekali.
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: () => {} }),
}))

import { goBackOrNavigate, type BackNavigator } from "@/lib/navigation"

function makeNav(canGoBack: boolean) {
  const nav: BackNavigator = {
    canGoBack: () => canGoBack,
    back: vi.fn(),
    replace: vi.fn(),
  }
  return nav
}

describe("goBackOrNavigate", () => {
  it("kembali lewat riwayat bila stack navigasi punya entri sebelumnya", () => {
    const nav = makeNav(true)
    goBackOrNavigate("/home", nav)
    expect(nav.back).toHaveBeenCalledTimes(1)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("memakai fallback bila tidak ada riwayat (deep link / tab baru)", () => {
    const nav = makeNav(false)
    goBackOrNavigate("/home", nav)
    expect(nav.replace).toHaveBeenCalledWith("/home")
    expect(nav.back).not.toHaveBeenCalled()
  })

  it("meneruskan tujuan fallback apa adanya, termasuk rute dinamis", () => {
    const nav = makeNav(false)
    goBackOrNavigate("/order/abc123", nav)
    expect(nav.replace).toHaveBeenCalledWith("/order/abc123")
  })

  it("selalu memilih salah satu jalur — tidak pernah no-op", () => {
    for (const canGoBack of [true, false]) {
      const nav = makeNav(canGoBack)
      goBackOrNavigate("/settings", nav)
      const calls = (nav.back as ReturnType<typeof vi.fn>).mock.calls.length
      const replaced = (nav.replace as ReturnType<typeof vi.fn>).mock.calls.length
      expect(calls + replaced).toBe(1)
    }
  })
})
