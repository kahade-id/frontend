import type { Badge } from "@/lib/api/badges"

/** Ownership comes from the user's badge collection, not a fabricated earned timestamp. */
export function mergeBadges(all: Badge[], mine: Badge[], ownershipComplete = true): Badge[] {
  const map = new Map<string, Badge>()
  for (const badge of all)
    map.set(badge.id || badge.code, {
      ...badge,
      earned: badge.earnedAt ? true : ownershipComplete ? false : undefined,
    })
  for (const badge of mine) {
    const key = badge.id || badge.code
    map.set(key, { ...map.get(key), ...badge, earned: true })
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(b.earned === true) - Number(a.earned === true) ||
      (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""),
  )
}
