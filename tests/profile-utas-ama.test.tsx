/**
 * Layar profil — tab Utas (Tanya Jawab ala AMA) dari sudut pandang
 * pengunjung dan pemilik. API dan navigasi di-mock; yang diuji pohon render
 * dan aturan siapa boleh bertanya / menjawab.
 *
 *   - Pengunjung: CTA "Tanya" tampil; pemilik TIDAK melihatnya.
 *   - Pemilik: pertanyaan belum dijawab punya tombol "Jawab" yang membuka
 *     sheet jawab di profil (bukan pindah ke inbox).
 *   - Pengunjung: tidak pernah melihat tombol "Jawab".
 *
 * Dijalankan dengan config komponen:
 *   npx vitest run --config vitest.components.config.ts tests/profile-utas-ama.test.tsx
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"

const mocks = vi.hoisted(() => ({
  me: null as Record<string, unknown> | null,
  questions: [] as Array<Record<string, unknown>>,
  answerQuestion: vi.fn(async () => ({})),
  addQuestion: vi.fn(async () => ({})),
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
        social: { followersCount: 3, followingCount: 2 },
      }),
      getMeCached: async () => mocks.me,
      getPublicQuestions: async () => ({ questions: mocks.questions, meta: { page: 1, limit: 20, total: mocks.questions.length, totalPages: 1 } }),
      getQuestionComments: async () => ({ comments: [] }),
      getFollowers: async () => ({ data: [], meta: { total: 3 } }),
      getFollowing: async () => ({ data: [], meta: { total: 2 } }),
      isFavorite: async () => ({ favorited: false }),
      checkSavedProfile: async () => false,
      getVerificationBadges: async () => [],
      answerQuestion: mocks.answerQuestion,
      addQuestion: mocks.addQuestion,
      addQuestionComment: ok,
      upvoteQuestion: ok,
      removeQuestionUpvote: ok,
    },
    ratings: { getPublicRatings: async () => ({ data: [] }) },
    settings: { blockUser: ok },
  }
  return {
    api,
    isApiError: () => false,
    userMessage: (e: unknown) => String(e),
  }
})
vi.mock("@/lib/api/ratings", () => ({
  readMyRatings: () => ({ items: [] }),
  firstRatingReply: () => undefined,
}))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true }))
// `fetch` harus STABIL antar render (hook asli memoize-nya); fetch baru tiap
// render membuat efek pemuatan profil berulang tanpa henti.
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

const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

beforeEach(() => {
  applyLanguage("id")
  clearTranslationCache()
  mocks.questions = [
    {
      id: "q1",
      question: "Apakah COD bisa?",
      createdAt: fiveMinutesAgo,
      askerId: "USR-SARI",
      asker: { username: "sari", fullName: "Sari" },
      upvoteCount: 0,
      answer: null,
    },
  ]
  mocks.answerQuestion.mockClear()
  mocks.addQuestion.mockClear()
})

afterEach(() => {
  cleanup()
  applyLanguage("id")
  clearTranslationCache()
})

async function openUtas() {
  // Dua tablist ada di DOM (strip in-flow + sticky yang tersembunyi); ambil yang pertama.
  const tab = (await screen.findAllByText("Utas"))[0]
  fireEvent.click(tab)
  await waitFor(() => expect(screen.getByText("Apakah COD bisa?")).toBeTruthy())
}

describe("tab Utas — pengunjung", () => {
  it("melihat CTA Tanya yang jelas dan tidak melihat tombol Jawab", async () => {
    mocks.me = { id: "ME-SARI", userId: "USR-SARI", username: "sari", fullName: "Sari" }
    renderThemed(<UserProfileScreen />)
    await openUtas()
    expect(screen.getByLabelText("Tanya @budi…")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Jawab" })).toBeNull()
  })

  it("CTA Tanya membuka dialog bertanya kepada pemilik", async () => {
    mocks.me = { id: "ME-SARI", userId: "USR-SARI", username: "sari", fullName: "Sari" }
    renderThemed(<UserProfileScreen />)
    await openUtas()
    fireEvent.click(screen.getByLabelText("Tanya @budi…"))
    expect(await screen.findByText("Bertanya kepada @budi")).toBeTruthy()
  })
})

describe("tab Utas — pemilik profil", () => {
  it("tidak melihat CTA Tanya — pemilik hanya menjawab", async () => {
    mocks.me = { id: "ME-BUDI", userId: "USR-OWNER", username: "budi", fullName: "Budi Santoso" }
    renderThemed(<UserProfileScreen />)
    await openUtas()
    expect(screen.queryByLabelText("Tanya @budi…")).toBeNull()
  })

  it("pertanyaan belum dijawab punya tombol Jawab di profil", async () => {
    mocks.me = { id: "ME-BUDI", userId: "USR-OWNER", username: "budi", fullName: "Budi Santoso" }
    renderThemed(<UserProfileScreen />)
    await openUtas()
    expect(screen.getByRole("button", { name: "Jawab" })).toBeTruthy()
  })

  it("tombol Jawab membuka sheet jawab di profil, tidak pindah ke inbox", async () => {
    mocks.me = { id: "ME-BUDI", userId: "USR-OWNER", username: "budi", fullName: "Budi Santoso" }
    renderThemed(<UserProfileScreen />)
    await openUtas()
    fireEvent.click(screen.getByRole("button", { name: "Jawab" }))
    expect(await screen.findByText("Jawab pertanyaan")).toBeTruthy()
    expect(screen.getByText("Dari Sari")).toBeTruthy()
  })
})
