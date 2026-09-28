/**
 * Test murni — riwayat artikel terakhir dilihat (F04).
 */
import { describe, expect, it } from "vitest"

import {
  clearHelpHistory,
  getHelpHistory,
  HELP_HISTORY_MAX,
  recordHelpArticleView,
} from "@/lib/help-history"

describe("help-history", () => {
  it("mencatat dan mengembalikan urutan terbaru dulu", async () => {
    await clearHelpHistory()
    await recordHelpArticleView({ articleId: "a1", slug: "s1", title: "Artikel 1" })
    await recordHelpArticleView({ articleId: "a2", slug: "s2", title: "Artikel 2" })
    const list = await getHelpHistory()
    expect(list.map((e) => e.articleId)).toEqual(["a2", "a1"])
  })

  it("membuka ulang artikel yang sama memindahkannya ke depan (tanpa duplikat)", async () => {
    await clearHelpHistory()
    await recordHelpArticleView({ articleId: "a1", slug: "s1", title: "Artikel 1" })
    await recordHelpArticleView({ articleId: "a2", slug: "s2", title: "Artikel 2" })
    await recordHelpArticleView({ articleId: "a1", slug: "s1", title: "Artikel 1" })
    const list = await getHelpHistory()
    expect(list.map((e) => e.articleId)).toEqual(["a1", "a2"])
  })

  it("dibatasi HELP_HISTORY_MAX entri", async () => {
    await clearHelpHistory()
    for (let i = 0; i < HELP_HISTORY_MAX + 5; i++) {
      await recordHelpArticleView({ articleId: `a${i}`, slug: `s${i}`, title: `A ${i}` })
    }
    const list = await getHelpHistory()
    expect(list.length).toBe(HELP_HISTORY_MAX)
    expect(list[0].articleId).toBe(`a${HELP_HISTORY_MAX + 4}`)
  })

  it("clearHelpHistory mengosongkan riwayat", async () => {
    await recordHelpArticleView({ articleId: "a9", slug: "s9", title: "A9" })
    await clearHelpHistory()
    expect(await getHelpHistory()).toEqual([])
  })
})
