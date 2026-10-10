/**
 * Kahade — slot player video konkuren (LR-008).
 *
 * Setiap <FeedVideo> yang me-mount player native memegang satu slot; bila
 * slot penuh, video menampilkan poster sampai ada slot bebas. Mencegah N
 * player berebut decoder/memori saat beberapa video ter-mount bersamaan
 * (galeri + viewer + pratinjau).
 *
 * Dipisahkan dari feed-video.tsx (audit etalase 2026-10-10, FD-01) karena
 * versi lama bocor: pemohon yang unmount sebelum kebagian slot meninggalkan
 * resolver di antrean, lalu `release` menaikkan hitungan untuk player yang
 * sudah tidak ada. Dua kejadian seperti itu membuat hitungan macet di batas
 * dengan nol player nyata — semua video di app mati sampai restart.
 *
 * Kontrak:
 * - `acquire()` sinkron: true = pemanggil memegang slot dan WAJIB `release()`.
 * - `wait(onGranted)` mengembalikan `cancel`. Bila slot diberikan, `onGranted`
 *   dipanggil SINKRON dari `release()` pemegang lain dan sejak saat itu
 *   pemanggil memegang slot (wajib `release()`). `cancel()` sebelum itu
 *   mencabut antrean tanpa efek samping; setelah itu no-op.
 * - `release()` meneruskan slot ke pemohon hidup berikutnya (pemohon yang
 *   sudah dibatalkan dilewati), kalau tidak ada → hitungan turun.
 */
export const MAX_CONCURRENT_VIDEO_PLAYERS = 2

type Waiter = { grant: () => void; settled: boolean }

let activeVideoPlayers = 0
const waiters: Waiter[] = []

export function acquireVideoPlayerSlot(): boolean {
  if (activeVideoPlayers < MAX_CONCURRENT_VIDEO_PLAYERS) {
    activeVideoPlayers += 1
    return true
  }
  return false
}

export function releaseVideoPlayerSlot(): void {
  activeVideoPlayers = Math.max(0, activeVideoPlayers - 1)
  // Serahkan ke pemohon HIDUP berikutnya — yang sudah cancel dilewati, bukan
  // dihitung (inilah kebocoran lama).
  while (waiters.length > 0) {
    const next = waiters.shift()!
    if (next.settled) continue
    next.settled = true
    activeVideoPlayers += 1
    next.grant()
    return
  }
}

export function waitForVideoPlayerSlot(onGranted: () => void): () => void {
  const waiter: Waiter = { grant: onGranted, settled: false }
  waiters.push(waiter)
  return () => {
    if (waiter.settled) return
    waiter.settled = true
    const at = waiters.indexOf(waiter)
    if (at >= 0) waiters.splice(at, 1)
  }
}

/** Untuk tes & diagnosa: hitungan slot terpakai dan pemohon yang menunggu. */
export function videoPlayerSlotStats(): { active: number; waiting: number } {
  return { active: activeVideoPlayers, waiting: waiters.filter((w) => !w.settled).length }
}

export function resetVideoPlayerSlotsForTests(): void {
  activeVideoPlayers = 0
  waiters.length = 0
}
