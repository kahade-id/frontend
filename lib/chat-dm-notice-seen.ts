/**
 * Kahade — notice sekali-per-lawan-bicara di ruang chat (2026-10-08).
 *
 * Sebelumnya peringatan "chat ini belum dilindungi…" tampil PERMANEN sebagai
 * banner di ruang DM (U5-008). Pengguna meminta banner itu hilang: peringatan
 * penting memang harus dibaca, tetapi banner yang menetap selamanya berubah
 * jadi hiasan — mata berhenti membacanya setelah dua kali, sementara ruang
 * jadi lebih sempit. Sekarang peringatan tampil SEKALI per lawan bicara
 * sebagai popup, lalu tidak pernah muncul lagi untuk orang yang sama.
 *
 * Keputusan non-obvious:
 *   - Kunci per LAWAN BICARA (bukan per room): DM dengan orang yang sama bisa
 *     punya beberapa room (arsip, chat ulang setelah dihapus). Peringatan yang
 *     muncul lagi di room baru untuk orang yang sama = pengulangan yang tidak
 *     diminta.
 *   - Disimpan lokal (SecureStore/memory, pola `chatHiddenKey`): ini preferensi
 *     tampilan per perangkat, bukan data akun — tidak ada endpoint backend dan
 *     TIDAK menambah kontrak API. Nilai yang disimpan hanya daftar id
 *     non-sensitif.
 *   - Gagal baca/tulis penyimpanan TIDAK boleh membuat popup loop: kalau
 *     penanda tidak bisa ditulis, popup tetap dianggap sudah dilihat untuk
 *     sesi berjalan (memori) supaya tidak muncul berulang kali di satu sesi.
 */
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"

/** Penanda yang sudah dilihat pada sesi ini — jaring pengaman bila storage gagal. */
const seenInSession = new Set<string>()
/** Cache daftar id yang sudah dilihat (dimuat sekali per kunci). */
const memory = new Map<string, Set<string>>()
const hydrated = new Set<string>()

const KEY = "kahade.chat.dmNoticeSeen"

/** Normalisasi id agar tidak bisa menyuntik isi daftar. */
function normalize(id: string): string {
  return String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128)
}

function persist(): void {
  const all = new Set<string>()
  for (const ids of memory.values()) for (const id of ids) all.add(id)
  if (all.size === 0) {
    void deleteRawItem(KEY).catch(() => undefined)
    return
  }
  void setRawItem(KEY, JSON.stringify([...all])).catch(() => undefined)
}

/**
 * Muat daftar id dari penyimpanan (sekali per proses). Aman dipanggil
 * berkali-kali; panggilan setelah hidrasi hanya membaca memori.
 */
export async function hydrateDmNoticeSeen(): Promise<void> {
  if (hydrated.has(KEY)) return
  hydrated.add(KEY)
  try {
    const raw = await getRawItem(KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const set = memory.get(KEY) ?? new Set<string>()
    for (const id of parsed) if (typeof id === "string" && id) set.add(id)
    memory.set(KEY, set)
  } catch {
    // Penyimpanan rusak / bukan JSON — mulai dari kosong.
  }
}

/** True bila peringatan sudah pernah dilihat untuk lawan bicara ini. */
export function hasSeenDmNotice(counterpartId: string): boolean {
  const id = normalize(counterpartId)
  if (!id) return true
  if (seenInSession.has(id)) return true
  return memory.get(KEY)?.has(id) ?? false
}

/** Tandai peringatan sudah dilihat untuk lawan bicara ini (idempoten). */
export function markDmNoticeSeen(counterpartId: string): void {
  const id = normalize(counterpartId)
  if (!id) return
  if (seenInSession.has(id) && memory.get(KEY)?.has(id)) return
  seenInSession.add(id)
  const set = memory.get(KEY) ?? new Set<string>()
  set.add(id)
  memory.set(KEY, set)
  hydrated.add(KEY)
  persist()
}

/** Hanya untuk test: bersihkan seluruh cache modul. */
export function __resetDmNoticeSeenForTests(): void {
  seenInSession.clear()
  memory.clear()
  hydrated.clear()
}
