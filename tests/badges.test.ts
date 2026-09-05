import { expect, it } from "vitest"
import { mergeBadges } from "@/lib/badges"
const badge = { id: "badge-one", code: "FIRST", name: "Lencana uji" }
it("owned badges stay earned without a made-up timestamp", () => {
  const [result] = mergeBadges([badge], [badge])
  expect(result.earned).toBe(true)
  expect(result.earnedAt).toBeUndefined()
})
it("never marks unreturned badges locked when ownership pagination is incomplete", () =>
  expect(mergeBadges([badge], [], false)[0].earned).toBeUndefined())
it("deduplicates catalog and owned entries and keeps an actual earned date", () => {
  const result = mergeBadges([badge], [{ ...badge, earnedAt: "2026-09-01T00:00:00Z" }])
  expect(result).toHaveLength(1)
  expect(result[0].earnedAt).toBe("2026-09-01T00:00:00Z")
})
