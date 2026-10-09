/**
 * Tab "Tentang" dan "Ulasan" di profil publik.
 *
 * Yang dikunci:
 *  - Keamanan: kontak (email/HP) hanya tampil bila flag `showContact*`
 *    bernilai `true` secara eksplisit. Flag yang tidak dikirim = tidak dibagikan.
 *  - Privasi: nomor order TIDAK tampil di kartu ulasan profil publik.
 *  - Balasan penjual tetap tampil (BFI-128: dibaca dari `replies[0]`).
 *
 * Catatan: semua mock stabil antar render (lihat catatan di
 * tests/profile-utas-ama.test.tsx — fungsi/objek baru tiap render memicu loop).
 */
import type React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { PublicUserProfile } from "@/lib/api/users"
import type { Rating } from "@/lib/api/ratings"

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
  useIsFocused: () => true,
}))

// Ringkasan distribusi di-fetch sendiri; di test cukup respons kosong yang valid.
vi.mock("@/lib/api/ratings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/ratings")>()
  const summary = { averageRating: 4.5, distribution: { counts: [0, 0, 0, 1, 1], total: 2 } }
  return { ...actual, getPublicRatingSummary: async () => summary }
})

import { ProfileAboutTab } from "@/components/ui/profile-about-tab"
import { ProfileRatingsTab } from "@/components/ui/profile-ratings-tab"

afterEach(cleanup)

function renderThemed(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

const baseProfile = {
  id: "USR-1",
  username: "budi",
  fullName: "Budi Santoso",
  verified: true,
  trustScore: 90,
  createdAt: "2024-01-01T00:00:00.000Z",
} as PublicUserProfile

describe("ProfileAboutTab — kontak publik (fail closed)", () => {
  it("tidak menampilkan email bila flag showContactEmail tidak dikirim", () => {
    renderThemed(<ProfileAboutTab profile={{ ...baseProfile, contactEmail: "budi@contoh.id" }} />)
    expect(screen.queryByText("budi@contoh.id")).toBeNull()
    expect(screen.getAllByText("Tidak dibagikan").length).toBeGreaterThan(0)
  })

  it("tidak menampilkan nomor HP bila flag showContactPhone=false", () => {
    renderThemed(
      <ProfileAboutTab
        profile={{ ...baseProfile, contactPhone: "08123456789", showContactPhone: false }}
      />,
    )
    expect(screen.queryByText("08123456789")).toBeNull()
  })

  it("menampilkan email hanya bila showContactEmail=true", () => {
    renderThemed(
      <ProfileAboutTab profile={{ ...baseProfile, contactEmail: "budi@contoh.id", showContactEmail: true }} />,
    )
    expect(screen.getByText("budi@contoh.id")).toBeTruthy()
  })
})

describe("ProfileRatingsTab — kartu ulasan publik", () => {
  const rating: Rating = {
    id: "RT-1",
    orderId: "KHD-2026-0903-0142",
    stars: 5,
    comment: "Barang sesuai, pengiriman cepat.",
    authorUsername: "sari",
    createdAt: "2026-09-03T10:00:00.000Z",
    replies: [{ id: "RP-1", content: "Terima kasih kembali!", createdAt: "2026-09-04T10:00:00.000Z" }],
  } as Rating

  it("tidak menampilkan nomor order, tetapi menampilkan komentar dan balasan penjual", () => {
    renderThemed(
      <ProfileRatingsTab
        ratings={[rating]}
        loading={false}
        filter="all"
        onFilterChange={() => {}}
        sort="newest"
        onSortChange={() => {}}
        handle="budi"
      />,
    )
    // ReadMore merender teks untuk pengukuran juga — cukup pastikan ada.
    expect(screen.getAllByText("Barang sesuai, pengiriman cepat.").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Terima kasih kembali!").length).toBeGreaterThan(0)
    expect(screen.queryByText(/KHD-2026-0903-0142/)).toBeNull()
  })

  it("menampilkan state kosong yang sesuai untuk pengunjung", () => {
    renderThemed(
      <ProfileRatingsTab
        ratings={[]}
        loading={false}
        filter="all"
        onFilterChange={() => {}}
        sort="newest"
        onSortChange={() => {}}
        handle="budi"
      />,
    )
    expect(screen.getByText("Belum ada ulasan")).toBeTruthy()
  })
})
