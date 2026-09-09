/**
 * Kahade — resolusi URL media (avatar, foto sampul profil, gambar showcase,
 * lampiran chat, bukti pengiriman, logo metode pembayaran).
 *
 * ── Kenapa file ini ada ──
 *
 * Backend mengembalikan path gambar dalam beberapa bentuk dan TIDAK ADA
 * jaminan bentuknya absolut:
 *
 *   1. `https://cdn.kahade.id/avatar/xyz.jpg`  → siap pakai.
 *   2. `/uploads/avatar/xyz.jpg`               → RELATIF terhadap host API.
 *   3. `avatar/xyz.jpg`                        → relatif tanpa slash depan.
 *   4. `//cdn.kahade.id/avatar/xyz.jpg`        → protocol-relative.
 *   5. `http://api.kahade.id/uploads/xyz.jpg`  → skema http.
 *
 * Bentuk 2–5 dipakai apa adanya oleh `<Image source={{ uri }}>` dan hasilnya
 * GAMBAR TIDAK PERNAH MUNCUL:
 *   - Di web, `/uploads/…` diselesaikan browser terhadap ORIGIN PREVIEW
 *     (mis. https://8081-xxx.e2b.app/uploads/…) → 404, bukan ke host API.
 *   - Bentuk 5 diblokir browser sebagai mixed content karena halaman web
 *     disajikan lewat HTTPS → gambar kosong tanpa error yang terlihat.
 *   - Di native, bentuk 2/3 bukan URI yang valid → `onError` → fallback
 *     inisial/placeholder selamanya, walau datanya ada.
 *
 * `resolveMediaUrl()` menormalkan SEMUA bentuk itu menjadi URL absolut yang
 * bisa dimuat, memakai `API_BASE_URL` sebagai dasar untuk path relatif.
 * Dipanggil di DUA komponen gambar bersama (<Avatar> dan <Picture>) supaya
 * setiap call site ikut terlindungi tanpa harus mengingatnya.
 *
 * Keputusan non-obvious:
 *   - `data:`, `blob:`, `file:`, `content:`, `ph:`, `asset-library:` DIBIARKAN.
 *     Itu URI lokal (hasil image-picker, preview sebelum unggah) dan justru
 *     rusak bila ditempeli host API.
 *   - `http://` di-upgrade ke `https://` HANYA bila hostnya = host API. Host
 *     lain tidak kita tebak: bisa jadi memang hanya melayani http (native
 *     masih bisa memuatnya), dan upgrade paksa akan mengubah gambar yang
 *     tadinya tampil menjadi gagal di Android.
 *   - Nilai yang tidak bisa dijadikan URL aman menghasilkan `undefined`,
 *     BUKAN string kosong: pemanggil (Avatar/Picture) memakai `undefined`
 *     sebagai sinyal "tidak ada gambar" dan jatuh ke inisial/placeholder —
 *     jalur yang sama dengan data yang memang kosong.
 *   - `API_BASE_URL` boleh berupa path proxy same-origin (mis. `/api`) di web
 *     — lihat lib/api/environment.ts. Pada kasus itu path relatif dibiarkan
 *     relatif terhadap origin yang sama, dan itu memang benar.
 */
import { API_BASE_URL } from "@/lib/api/config"

/** Skema URI lokal yang tidak boleh ditempeli host API. */
const LOCAL_SCHEME = /^(?:data|blob|file|content|ph|asset-library|local-asset):/i

/** Bentuk sumber gambar yang diterima <Avatar>/<Picture> dari call site. */
export type MediaSource = string | number | { uri?: string | null } | null | undefined

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

const API_HOST = hostOf(API_BASE_URL)

/**
 * Gabungkan path relatif dengan dasar API tanpa menggandakan slash. Berlaku
 * sama untuk dasar absolut (`https://api.kahade.id`) maupun path proxy
 * same-origin (`/api`) — keduanya hanya butuh satu slash pemisah.
 */
function againstApiBase(path: string): string {
  return `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

/**
 * Normalkan satu URL gambar dari backend menjadi URL yang bisa dimuat.
 * Mengembalikan `undefined` bila nilai kosong/tidak berbentuk URL.
 */
export function resolveMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim()
  if (!raw) return undefined

  // URI lokal (image-picker, blob preview) — pakai apa adanya.
  if (LOCAL_SCHEME.test(raw)) return raw

  // Sudah absolut & aman.
  if (/^https:\/\//i.test(raw)) return raw

  // http:// → https:// hanya untuk host API sendiri (mixed content di web).
  if (/^http:\/\//i.test(raw)) {
    const upgraded = `https://${raw.slice("http://".length)}`
    if (API_HOST && hostOf(upgraded) === API_HOST) return upgraded
    return raw
  }

  // Protocol-relative: ikuti skema halaman (https di produksi).
  if (raw.startsWith("//")) return `https:${raw}`

  // Relatif (dengan atau tanpa slash depan) → tempelkan ke host API.
  if (raw.startsWith("/") || !/^[a-z][a-z\d+\-.]*:/i.test(raw)) return againstApiBase(raw)

  // Skema lain yang tidak dikenali (mis. ftp:) — jangan dimuat diam-diam.
  return undefined
}

/**
 * Normalkan prop `source` komponen gambar: string → `{ uri }`, objek
 * `{ uri }` → uri-nya diselesaikan, `require()` (number) → diteruskan.
 * Mengembalikan `undefined` bila tidak ada gambar yang bisa dimuat.
 */
export function resolveMediaSource(
  source: MediaSource | ReadonlyArray<MediaSource>,
): { uri: string } | number | undefined {
  if (source == null) return undefined
  if (typeof source === "number") return source
  if (Array.isArray(source)) return resolveMediaSource(source[0])
  if (typeof source === "string") {
    const uri = resolveMediaUrl(source)
    return uri ? { uri } : undefined
  }
  if (typeof source === "object" && "uri" in source) {
    const uri = resolveMediaUrl(source.uri)
    return uri ? { uri } : undefined
  }
  return undefined
}
