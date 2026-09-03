/**
 * Kahade — `cn()`: gabung className kondisional.
 *
 * Sengaja TIDAK memakai tailwind-merge (non-obvious): theme kita punya class
 * dengan prefix yang sama untuk kategori berbeda, mis. `text-h1` (type scale)
 * dan `text-text-primary` (warna). tailwind-merge default akan menganggap
 * keduanya "text-*" yang saling menimpa dan membuang salah satunya. Join
 * sederhana lebih aman; urutan override cukup diserahkan ke Tailwind.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  for (const v of inputs) {
    if (!v) continue
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v))
    } else if (Array.isArray(v)) {
      const inner = cn(...v)
      if (inner) out.push(inner)
    } else {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k)
    }
  }
  return out.join(" ")
}
