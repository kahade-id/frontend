/**
 * Kahade — offset jam server (F-13 audit 2026-09-20).
 *
 * Semua countdown/deadline sebelumnya memakai `Date.now()` mentah. Perangkat
 * dengan jam maju/mundur melihat tenggat yang salah — di kasus ekstrem
 * pengguna mengira masih punya waktu konfirmasi penerimaan barang (dana lepas
 * otomatis) atau OTP "kedaluwarsa" padahal valid.
 *
 * Solusi: offset = jamServer - jamPerangkat, dihitung dari header `Date`
 * respons API (RFC 9110 §5.6.7 — detik presisi, wajib dikirim origin server).
 * Transport (`lib/api/client.ts`) memanggil `recordServerDate()` setiap kali
 * respons datang; `serverNow()` dipakai komponen waktu (Countdown, deadline).
 *
 * Keputusan non-obvious:
 *   - Presisi header Date hanya 1 detik — cukup untuk countdown menit/jam.
 *     Selisih < 1,5 detik dianggap noise dan TIDAK diperbarui agar offset
 *     tidak bergetar tiap request.
 *   - Tanpa smoothing/average: offset terakhir yang menang, karena satu-satunya
 *     penyebab offset berubah drastis adalah pengguna mengoreksi jam perangkat
 *     — dan nilai terbaru justru yang benar.
 *   - `maxAgeMs` opsional: offset basi (> 24 jam tanpa satu pun respons API)
 *     diabaikan dan jatuh ke jam perangkat. Aplikasi yang dibuka offline tidak
 *     boleh memakai koreksi dari sesi lama yang mungkin tidak valid lagi.
 */

/** Ambang update: perubahan di bawah ini dianggap noise presisi header. */
const MIN_UPDATE_DELTA_MS = 1_500
/**
 * E-07 (audit 2026-09-22): jam perangkat yang bergeser PERLAHAN (koreksi NTP
 * bertahap, atau pengguna mengoreksi beberapa detik) menghasilkan delta <
 * MIN_UPDATE_DELTA_MS pada setiap sampel, jadi offset lama tidak pernah
 * dikoreksi dan bertahan sepanjang sesi. Bila drift searah terlihat bertahan
 * selama ini, sampel terbaru diterima walaupun kecil.
 */
const DRIFT_ACCEPT_MS = 5 * 60 * 1000
/** Offset lebih tua dari ini tidak dipercaya lagi (jatuh ke jam perangkat). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

let offsetMs = 0
let recordedAt = 0
let driftCandidateMs: number | null = null
let driftSinceMs = 0

function resetDrift(): void {
  driftCandidateMs = null
  driftSinceMs = 0
}

/**
 * Catat header `Date` dari respons API. Aman dipanggil dengan null/undefined
 * (respons tanpa header, cache, dsb.) — diabaikan diam-diam.
 *
 * E-08 (audit 2026-09-22): perangkat yang jamnya berubah saat aplikasi
 * berjalan (mis. pengguna mengaktifkan "waktu otomatis" lalu zona terkoreksi)
 * selalu menghasilkan delta besar pada sampel berikutnya, sehingga langsung
 * diterima lewat cabang pertama — countdown menyesuaikan diri pada respons API
 * berikutnya, bukan menunggu restart.
 */
export function recordServerDate(headerValue: string | null | undefined): void {
  if (!headerValue) return
  const serverMs = Date.parse(headerValue)
  if (!Number.isFinite(serverMs)) return
  const nextOffset = serverMs - Date.now()
  if (!Number.isFinite(nextOffset)) return
  const now = Date.now()

  if (recordedAt === 0) {
    offsetMs = nextOffset
    recordedAt = now
    resetDrift()
    return
  }

  const delta = nextOffset - offsetMs
  if (Math.abs(delta) >= MIN_UPDATE_DELTA_MS) {
    offsetMs = nextOffset
    recordedAt = now
    resetDrift()
    return
  }

  if (driftCandidateMs !== null && Math.sign(delta) === Math.sign(driftCandidateMs)) {
    if (now - driftSinceMs >= DRIFT_ACCEPT_MS) {
      offsetMs = nextOffset
      recordedAt = now
      resetDrift()
      return
    }
  } else {
    driftCandidateMs = delta
    driftSinceMs = now
  }
  recordedAt = now
}

/** Offset terakhir (ms) untuk uji/debug. 0 = belum pernah ada respons API. */
export function getTimeOffsetMs(): number {
  return recordedAt !== 0 && Date.now() - recordedAt <= MAX_AGE_MS ? offsetMs : 0
}

/** "Sekarang" menurut jam server — pengganti `Date.now()` untuk tenggat/countdown. */
export function serverNow(): number {
  return Date.now() + getTimeOffsetMs()
}

/** Reset (dipakai test dan saat logout bila diperlukan). */
export function resetServerTime(): void {
  offsetMs = 0
  recordedAt = 0
  resetDrift()
}
