import { safeHttpsLink } from "@/lib/external-url"

/** Compare numeric version segments without the 1.2 vs 1.2.0 radix bug. Invalid data never forces an update. */
export function compareVersions(
  left: string | null | undefined,
  right: string | null | undefined,
): number | null {
  const parse = (value: string | null | undefined) => {
    if (!value || !/^\d+(?:\.\d+)*(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i.test(value)) return null
    return value.split(/[-+]/)[0].split(".").map(Number)
  }
  const a = parse(left),
    b = parse(right)
  if (!a || !b || [...a, ...b].some((n) => !Number.isSafeInteger(n))) return null
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0)
    if (difference) return Math.sign(difference)
  }
  return 0
}

/**
 * D-01 (audit): aturan skema URL kini hidup di SATU tempat
 * (`lib/external-url.ts`) supaya tidak ada dua validator yang bisa berbeda
 * pendapat. Nama ini dipertahankan karena sudah dipakai banyak call-site.
 */
export function safeHttpsUrl(value: unknown): string | undefined {
  return safeHttpsLink(value)
}
