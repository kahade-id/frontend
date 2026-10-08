import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  __failNextStoryCall,
  __resetStoryMock,
  STORY_LIFETIME_MS,
  STORY_REACTIONS,
  createStory,
  createStoryHighlight,
  deleteStory,
  getMutedStoryAuthors,
  getStoryHighlights,
  getStoryTray,
  getUserStories,
  getStoryViewers,
  markStoryViewed,
  muteStoryAuthor,
  replyToStory,
  setStoryReaction,
  STORY_API_MODE,
  unmuteStoryAuthor,
  updateStoryHighlight,
  deleteStoryHighlight,
} from "@/lib/api/story"

// Mock berjalan dengan latensi ~220ms; tes memakai timer nyata.
beforeEach(() => __resetStoryMock())
afterEach(() => __resetStoryMock())

describe("API story (mode mock)", () => {
  it("default mode adalah mock kecuali EXPO_PUBLIC_STORY_API=live", () => {
    expect(STORY_API_MODE).toBe("mock")
  })

  it("tray hanya memuat penulis yang disimpan profilnya, dan story sendiri di own", async () => {
    const tray = await getStoryTray()
    expect(tray.own).toBeNull()
    const ids = tray.others.map((e) => e.author.userId)
    expect(ids).toEqual(expect.arrayContaining(["usr-ana", "usr-budi", "usr-sari"]))
    expect(ids).not.toContain("usr-me")
  })

  it("story baru tampil di own dan batas teks/tag divalidasi klien", async () => {
    const s = await createStory({
      kind: "text",
      text: "Restock",
      backgroundColor: "#0F766E",
      productTags: [],
      audience: { mode: "all_savers" },
    })
    expect(Date.parse(s.expiresAt) - Date.parse(s.createdAt)).toBe(STORY_LIFETIME_MS)
    const tray = await getStoryTray()
    expect(tray.own?.storyCount).toBe(1)
    await expect(
      createStory({ kind: "text", text: "  ", productTags: [], audience: { mode: "all_savers" } }),
    ).rejects.toMatchObject({ backendCode: "STORY_TEXT_REQUIRED" })
  })

  it("tandai dilihat mengubah ring; error 404 untuk story yang tak ada", async () => {
    const { stories } = await getUserStories("usr-ana")
    expect(stories.length).toBeGreaterThan(0)
    await markStoryViewed(stories[0].id)
    const again = await getUserStories("usr-ana")
    expect(again.stories[0].viewed).toBe(true)
    await expect(deleteStory("tidak-ada")).rejects.toMatchObject({ status: 404 })
  })

  it("viewer hanya untuk pemilik; reaksi divalidasi terhadap daftar emoji", async () => {
    const mine = await createStory({ kind: "text", text: "x", productTags: [], audience: { mode: "all_savers" } })
    const page = await getStoryViewers(mine.id)
    expect(page.total).toBeGreaterThan(0)
    await expect(getStoryViewers("usr-ana-story-orang-lain")).rejects.toMatchObject({ status: 404 })
    expect(STORY_REACTIONS).toContain("🔥")
    await expect(setStoryReaction("st-ana-1", "🤬" as never)).rejects.toMatchObject({
      backendCode: "STORY_REACTION_INVALID",
    })
  })

  it("balas story mengembalikan roomId; balasan kosong ditolak", async () => {
    const { roomId } = await replyToStory("st-ana-1", "Masih ada ukuran 42?")
    expect(roomId).toMatch(/usr-ana/)
    await expect(replyToStory("st-ana-1", "   ")).rejects.toMatchObject({ backendCode: "STORY_REPLY_EMPTY" })
  })

  it("bisukan memindahkan penulis ke daftar bisu; buka bisu mengembalikannya", async () => {
    await muteStoryAuthor("usr-budi")
    const muted = await getMutedStoryAuthors()
    expect(muted.map((a) => a.userId)).toEqual(["usr-budi"])
    const tray = await getStoryTray()
    expect(tray.others.find((e) => e.author.userId === "usr-budi")?.muted).toBe(true)
    await unmuteStoryAuthor("usr-budi")
    expect(await getMutedStoryAuthors()).toEqual([])
  })

  it("highlight menyalin story dan tetap ada setelah story dihapus", async () => {
    const s = await createStory({ kind: "text", text: "Katalog musim ini", productTags: [], audience: { mode: "all_savers" } })
    const hl = await createStoryHighlight({ title: "Katalog", storyIds: [s.id] })
    await deleteStory(s.id)
    const list = await getStoryHighlights("usr-me")
    expect(list.map((h) => h.title)).toContain("Katalog")
    expect(list.find((h) => h.id === hl.id)?.stories[0].text).toBe("Katalog musim ini")

    const renamed = await updateStoryHighlight(hl.id, { title: "Testimoni" })
    expect(renamed.title).toBe("Testimoni")
    await deleteStoryHighlight(hl.id)
    expect((await getStoryHighlights("usr-me")).find((h) => h.id === hl.id)).toBeUndefined()
  })

  it("kegagalan yang disuntikkan melempar galat (dasar rollback di UI)", async () => {
    __failNextStoryCall("muteStoryAuthor")
    await expect(muteStoryAuthor("usr-ana")).rejects.toMatchObject({ code: "NETWORK" })
    expect(await getMutedStoryAuthors()).toEqual([])
  })
})
