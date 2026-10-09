/**
 * Regresi onboarding (overhaul auth 2026-10-10).
 *
 * Bug yang dijaga: `app/(auth)/onboarding.tsx` sempat dirender sebagai layar
 * "logo + dua tombol" sementara <OnboardingCarousel> dan ONBOARDING_SLIDES
 * tidak punya importer sama sekali — slide intro TIDAK PERNAH tampil di
 * Android maupun iOS. Test ini mengunci dua hal yang tidak bisa dijamin
 * pemeriksaan statis:
 *   1. layar onboarding benar-benar meneruskan slide ke carousel (bukan
 *      sekadar mengimpor komponennya), dan
 *   2. copy slide bebas istilah internal yang dilarang ("escrow", "rekber",
 *      "ditahan") — di semua slide, bukan hanya yang pertama.
 *
 * Carousel-nya sendiri di-mock: pager FlatList mengukur lebar lewat
 * `onLayout`, yang tidak pernah terpicu di jsdom, sehingga merender carousel
 * asli di sini hanya akan menghasilkan pohon kosong dan test yang berbohong.
 */
import type { ReactElement } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const carousel = vi.hoisted(() => ({
  received: [] as { keys: string[]; index: number }[],
  scrollTo: vi.fn(),
}))

vi.mock("@/components/onboarding/onboarding-carousel", () => ({
  OnboardingCarousel: ({ slides, index }: { slides: readonly { key: string }[]; index: number }) => {
    carousel.received.push({ keys: slides.map((slide) => slide.key), index })
    return <div data-testid="carousel" data-slide-keys={slides.map((slide) => slide.key).join(",")} />
  },
}))

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))
vi.mock("@/lib/onboarding", () => ({
  hasSeenOnboarding: vi.fn().mockResolvedValue(false),
  markOnboardingSeen: vi.fn().mockResolvedValue(undefined),
}))

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import OnboardingScreen from "@/app/(auth)/onboarding"
import { ONBOARDING_SLIDES, OnboardingSlideView } from "@/components/onboarding/slides"

const BANNED_WORDS = ["escrow", "rekber", "ditahan"] as const

function themed(ui: ReactElement) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PortalProvider>
          {ui}
          <PortalHost />
        </PortalProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

function textOf(node: HTMLElement): string {
  return (node.textContent ?? "").toLowerCase()
}

afterEach(() => {
  carousel.received = []
  cleanup()
})

describe("onboarding merender slide intro", () => {
  it("meneruskan ketiga slide ke carousel (regresi layar logo tanpa slide)", () => {
    render(themed(<OnboardingScreen />))

    const view = screen.getByTestId("carousel")
    expect(view.getAttribute("data-slide-keys")).toBe("guarantee,release,protection")
    expect(carousel.received.length).toBeGreaterThan(0)
    expect(carousel.received[0]?.index).toBe(0)
  })

  it("menampilkan indikator halaman sesuai jumlah slide", () => {
    render(themed(<OnboardingScreen />))

    expect(screen.getByRole("progressbar")).toBeTruthy()
    expect(screen.getByLabelText("Halaman 1 dari 3")).toBeTruthy()
  })

  it("menyediakan pintu Daftar dan Masuk tanpa harus menyelesaikan slide", () => {
    render(themed(<OnboardingScreen />))

    // Keduanya selalu terlihat di SETIAP slide: user baru tidak boleh
    // terjebak di intro, user lama tidak dipaksa menggeser untuk masuk.
    expect(screen.getByRole("button", { name: "Daftar" })).toBeTruthy()
    expect(screen.getByText("Masuk")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Lanjut" })).toBeTruthy()
  })
})

describe("copy slide onboarding", () => {
  it("punya tiga slide dengan eyebrow, judul, dan body terisi", () => {
    expect(ONBOARDING_SLIDES).toHaveLength(3)
    for (const slide of ONBOARDING_SLIDES) {
      expect(slide.eyebrow.trim().length).toBeGreaterThan(0)
      expect(slide.title.trim().length).toBeGreaterThan(0)
      expect(slide.body.trim().length).toBeGreaterThan(0)
      expect(slide.artifact).toBeTruthy()
    }
  })

  it.each(ONBOARDING_SLIDES.map((slide) => [slide.key, slide] as const))(
    "slide %s bebas istilah escrow/rekber/ditahan di teks maupun artefak",
    (_key, slide) => {
      const { container } = render(
        themed(<OnboardingSlideView slide={slide} width={360} active />),
      )
      const rendered = textOf(container)

      for (const word of BANNED_WORDS) expect(rendered).not.toContain(word)
      expect(rendered).toContain(slide.title.toLowerCase())
      cleanup()
    },
  )

  it("label aksesibilitas slide ikut bebas istilah terlarang", () => {
    for (const slide of ONBOARDING_SLIDES) {
      const { container } = render(
        themed(<OnboardingSlideView slide={slide} width={360} active />),
      )
      const labels = Array.from(container.querySelectorAll("[aria-label]"))
        .map((node) => node.getAttribute("aria-label") ?? "")
        .join(" ")
        .toLowerCase()

      for (const word of BANNED_WORDS) expect(labels).not.toContain(word)
      cleanup()
    }
  })
})
