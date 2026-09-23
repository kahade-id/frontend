import { beforeEach, describe, expect, it } from "vitest"
import { mergeComments, patchComments, validImageOrder, showcaseIsHidden, acquireShowcaseMutation } from "@/lib/showcase-state"
import { parseShowcaseItem, parseShowcaseComment, type ShowcaseCommentWithReplies } from "@/lib/api/showcase"
import { clearSession, startSession } from "@/lib/api/session"
import { isShowcaseSaved, toggleShowcaseSaved, setShowcaseLikeState, getShowcaseLikeOverride, loadShowcaseBookmarks } from "@/lib/showcase-social-prefs"
import { setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import { showcaseUrl } from "@/lib/deeplinks"

const author = { userId: "u", username: "seller", fullName: null }
const comment = (id: string, replies: ShowcaseCommentWithReplies[] = []): ShowcaseCommentWithReplies => ({ id, showcaseId: "item", content: id, createdAt: "2026-09-23", author, replies })
const rawItem = { id: "item", author, title: "Test", images: [] }

beforeEach(async () => { await clearSession() })

describe("Etalase regression invariants", () => {
  it("E01 deleting one reply preserves unrelated roots and siblings", () => {
    const input = [comment("a", [comment("a1"), comment("a2")]), comment("b")]
    const output = patchComments(input, c => c.id === "a1" ? null : c)
    expect(output.map(c => c.id)).toEqual(["a", "b"])
    expect(output[0].replies?.map(c => c.id)).toEqual(["a2"])
    expect(input[0].replies).toHaveLength(2)
  })
  it("E01 removing a root does not delete unrelated roots", () => {
    expect(patchComments([comment("a"), comment("b")], c => c.id === "a" ? null : c).map(c => c.id)).toEqual(["b"])
  })
  it("E25 overlapping offset pages have unique root and reply IDs", () => {
    const result = mergeComments([comment("a", [comment("a1")])], [comment("a", [comment("a1"), comment("a2")]), comment("b")])
    expect(result.map(c => c.id)).toEqual(["a", "b"])
    expect(result[0].replies?.map(c => c.id)).toEqual(["a1", "a2"])
  })
  it.each([
    [["c", "b", "a"], ["a", "b"], false],
    [["a", "a"], ["a", "b"], false],
    [["b", "a"], ["a", "b"], true],
    [null, ["a"], false],
    [["a"], ["a", "b"], false],
  ] as const)("E46 validates complete unique reorder sets %j", (draft, server, valid) => {
    expect(validImageOrder(draft ? [...draft] : null, [...server])).toBe(valid)
  })
  it.each([
    [true, "PUBLIC", false], [false, "PUBLIC", true], [true, "PRIVATE", true], [false, "PRIVATE", true],
  ] as const)("E48/E49 active=%s visibility=%s has consistent status", (isActive, visibility, hidden) => {
    expect(showcaseIsHidden({ isActive, visibility })).toBe(hidden)
  })
  it("E05 lock covers multiple consumers, releases for retry", () => {
    const release = acquireShowcaseMutation("account:item")!
    expect(acquireShowcaseMutation("account:item")).toBeNull()
    release()
    const again = acquireShowcaseMutation("account:item")
    expect(again).not.toBeNull()
    again?.()
  })
  it("E03 logout clears likes and bookmarks", async () => {
    await startSession({ accessToken: "a" })
    toggleShowcaseSaved("item")
    setShowcaseLikeState("item", { isLiked: true, likeCount: 9 })
    await clearSession()
    expect(isShowcaseSaved("item")).toBe(false)
    expect(getShowcaseLikeOverride("item")).toBeUndefined()
  })
  it("E07 persisted bookmark IDs hydrate only for their owner", async () => {
    await setSecureItem(SecureKeys.showcaseBookmarks, JSON.stringify({ owner: "a", ids: ["one"] }))
    await loadShowcaseBookmarks("b")
    expect(isShowcaseSaved("one")).toBe(false)
    await loadShowcaseBookmarks("a")
    expect(isShowcaseSaved("one")).toBe(true)
  })
  it("E53 missing/null images normalize before rendering", () => {
    expect(parseShowcaseItem({ ...rawItem, images: null }).images).toEqual([])
    expect(parseShowcaseItem({ ...rawItem, likeCount: -3, viewCount: Infinity }).likeCount).toBe(0)
    expect(parseShowcaseItem({ ...rawItem, description: {} }).description).toBeNull()
  })
  it.each([null, {}, { ...rawItem, author: null }, { ...rawItem, author: {} }])("E53 malformed identity is rejected %j", raw => {
    expect(() => parseShowcaseItem(raw)).toThrow()
  })
  it("E53 comment identity is validated", () => {
    expect(() => parseShowcaseComment({ id: "1", content: "ok", author: null })).toThrow()
    expect(parseShowcaseComment(comment("ok")).id).toBe("ok")
  })
  it("E34 explicit zero differs from unspecified price", () => {
    expect(showcasePriceLabel({ priceMin: 0, priceMax: 0 })).toBe("Rp 0")
    expect(showcasePriceLabel({ priceMin: null, priceMax: null })).toBeNull()
    expect(showcasePriceLabel({ priceMin: NaN })).toBeNull()
  })
  it("E54 canonical links encode exactly one path segment", () => {
    expect(showcaseUrl("a/b?c#d")).toBe("https://kahade.id/showcase/a%2Fb%3Fc%23d")
  })
})
