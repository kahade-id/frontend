/**
 * Layar profil — tombol Ikuti & statistik sosial (audit 2026-10-10).
 *
 *  - Idempoten: server menjawab 409 ALREADY_FOLLOWING (mis. sudah diikuti
 *    dari perangkat lain / replay antrean offline) → state TETAP "Mengikuti",
 *    tanpa rollback & tanpa toast gagal; angka pengikut kembali ke nilai
 *    server (bukan +1 optimistis).
 *  - Galat lain → rollback ke "Ikuti" (perilaku lama dipertahankan).
 *  - Counter "Privat" (null dari payload) TIDAK lagi ditimpa total daftar
 *    (`getFollowers`/`getFollowing` ?limit=1 tidak dipanggil lagi).
 *  - Profil sendiri menampilkan statistik + [Ubah profil] [Bagikan] [QR].
 *
 * Dijalankan dengan config komponen:
 *   npx vitest run --config vitest.components.config.ts tests/profile-follow-idempotent.test.tsx
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"

type FakeApiError = { status: number; backendCode?: string; message: string }

const mocks = vi.hoisted(() => ({
  me: null as Record<string, unknown> | null,
  social: { followersCount: 3, followingCount: 2, isFollowing: false } as Record<string, unknown>,
  followUser: vi.fn(async () => undefined as unknown),
  getFollowers: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
  getFollowing: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
}))

vi.mock("@/lib/api", () => {
  const ok = async () => ({})
  const api = {
    users: {
      getUserByUsername: async () => ({
        id: "USR-OWNER",
        username: "budi",
        fullName: "Budi Santoso",
        bio: null,
        avatarUrl: null,
        headerUrl: null,
        verified: false,
        ratingCount: 7,
        social: mocks.social,
        links: [],
      }),
      getMeCached: async () => mocks.me,
      getPublicQuestions: async () => ({ questions: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
      getQuestionComments: async () => ({ comments: [] }),
      getFollowers: mocks.getFollowers,
      getFollowing: mocks.getFollowing,
      checkSavedProfile: async () => false,
      getVerificationBadges: async () => [],
      followUser: mocks.followUser,
      unfollowUser: ok,
      answerQuestion: ok,
      addQuestion: ok,
      addQuestionComment: ok,
      upvoteQuestion: ok,
      removeQuestionUpvote: ok,
    },
    ratings: { getPublicRatings: async () => ({ data: [] }) },
    settings: { blockUser: ok },
  }
  return {
    api,
    isApiError: (e: unknown) => Boolean(e && typeof e === "object" && "status" in e),
    userMessage: (e: unknown) => (e as FakeApiError)?.message ?? String(e),
  }
})
vi.mock("@/lib/api/ratings", () => ({
  readMyRatings: () => ({ items: [] }),
  firstRatingReply: () => undefined,
}))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true }))
vi.mock("@/lib/use-profile-showcase", () => {
  const stable = { items: [], loading: false, error: null, fetch: () => {} }
  return { useProfileShowcase: () => stable }
})
vi.mock("@/components/ui/profile-etalase-tab", () => ({ ProfileEtalaseTab: () => null }))
vi.mock("@/components/ui/profile-highlights-strip", () => ({ ProfileHighlightsStrip: () => null }))
vi.mock("@/components/story/story-highlights-strip", () => ({ StoryHighlightsStrip: () => null }))
vi.mock("@/components/ui/profile-edit-sheet", () => ({ ProfileEditSheet: () => null }))
vi.mock("expo-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("expo-router")>()
  return {
    ...mod,
    router: { push: vi.fn(), navigate: vi.fn(), back: vi.fn(), replace: vi.fn() },
    useLocalSearchParams: () => ({ username: "budi" }),
  }
})

import UserProfileScreen from "@/components/screens/user-profile-screen"

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

beforeEach(() => {
  applyLanguage("id")
  clearTranslationCache()
  mocks.me = { id: "ME-SARI", userId: "USR-SARI", username: "sari", fullName: "Sari" }
  mocks.social = { followersCount: 3, followingCount: 2, isFollowing: false }
  mocks.followUser.mockReset()
  mocks.getFollowers.mockClear()
  mocks.getFollowing.mockClear()
})

afterEach(() => {
  cleanup()
  applyLanguage("id")
  clearTranslationCache()
})

async function findFollowButton() {
  return await screen.findByRole("button", { name: "Ikuti" })
}

describe("tombol Ikuti — idempoten terhadap state server", () => {
  it("409 ALREADY_FOLLOWING → tetap 'Mengikuti', angka pengikut = nilai server", async () => {
    mocks.followUser.mockRejectedValueOnce({
      status: 409,
      backendCode: "ALREADY_FOLLOWING",
      message: "Already following this user",
    } satisfies FakeApiError)
    renderThemed(<UserProfileScreen />)
    fireEvent.click(await findFollowButton())
    await waitFor(() => expect(mocks.followUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "Mengikuti" })).toBeTruthy())
    expect(screen.queryByText("Gagal mengikuti")).toBeNull()
    // +1 optimistis dibatalkan: server tidak bertambah.
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.queryByText("4")).toBeNull()
  })

  it("galat lain → rollback ke 'Ikuti' + toast gagal", async () => {
    mocks.followUser.mockRejectedValueOnce({ status: 500, message: "Server error" } satisfies FakeApiError)
    renderThemed(<UserProfileScreen />)
    fireEvent.click(await findFollowButton())
    await waitFor(() => expect(mocks.followUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: "Ikuti" })).toBeTruthy())
    expect(await screen.findByText("Gagal mengikuti")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
  })
})

describe("statistik sosial", () => {
  it("counter privat (null) tampil 'Privat' dan tidak ditimpa total daftar", async () => {
    mocks.social = { followersCount: null, followingCount: 2, isFollowing: false }
    renderThemed(<UserProfileScreen />)
    expect(await screen.findByText("Privat")).toBeTruthy()
    await findFollowButton()
    expect(mocks.getFollowers).not.toHaveBeenCalled()
    expect(mocks.getFollowing).not.toHaveBeenCalled()
  })

  it("profil sendiri: statistik tampil + Ubah profil, Bagikan profil, Kode QR", async () => {
    mocks.me = { id: "ME-BUDI", userId: "USR-OWNER", username: "budi", fullName: "Budi Santoso" }
    renderThemed(<UserProfileScreen />)
    expect(await screen.findByRole("button", { name: "Ubah profil" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Bagikan profil" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Kode QR profil" })).toBeTruthy()
    expect(screen.getByText("Pengikut")).toBeTruthy()
    expect(screen.getByText("Mengikuti")).toBeTruthy()
    expect(screen.getByText("7")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Ikuti" })).toBeNull()
  })
})
