/**
 * Kahade — state alur OTP sementara (B-07/B-14 audit, auth-rework 2026-09-26).
 *
 * Sebelumnya `phoneNumber`, `refCode`, `whatsappUrl`, `triggerText`, dan
 * `expiresAt` dilewatkan sebagai QUERY PARAMETER URL antar layar auth. Di web
 * itu berarti nomor HP + kode referensi masuk history browser, berpotensi
 * masuk log hosting/CDN, dan bocor lewat header Referer saat
 * `Linking.openURL` keluar aplikasi. Lebih buruk: `/verify-otp?phoneNumber=X`
 * bisa dibuka siapa pun untuk memicu resend OTP ke nomor korban (vektor OTP
 * bombing — B-14).
 *
 * Solusinya mengikuti preseden yang sudah ada di repo (`lib/registration.ts`,
 * tempToken 2FA di login): state alur disimpan di MEMORI modul, URL hanya
 * nama rute tanpa data. Sejak 2026-10-01 state JUGA dipersist ke SecureStore
 * (native) agar tahan restart aplikasi di tengah alur — skenario umum di
 * Android saat user pindah ke WhatsApp untuk mengirim pesan pemicu lalu OS
 * mematikan aplikasi di background. Tanpa persist, layar whatsapp-trigger /
 * verify-otp kembali dengan state kosong dan menampilkan layar putih.
 *
 * Auth-rework: OTP HANYA via WhatsApp customer-initiated — tidak ada lagi
 * pilihan metode SMS/WhatsApp. `purpose` membedakan 4 alur yang memakai
 * layar trigger + verify-otp yang sama: register, login, forgot_password,
 * migrate_phone.
 *
 * Hanya SATU alur OTP aktif pada satu waktu; `setOtpFlow` menimpa sebelumnya.
 *
 * ── REVISI 2026-10-01 (audit layar blank setelah trigger WhatsApp) ──────
 * Bug "layar blank" berulang karena konsumen membaca state SEKALI saat mount
 * (`useRef(getOtpFlow())`) lalu `return null` bila kosong. State bisa kosong
 * saat mount pada beberapa jalur nyata (JS context baru setelah proses
 * dimatikan OS di WhatsApp, pemulihan SecureStore yang belum selesai, atau
 * alur yang baru diset SETELAH layar tujuan ter-mount) dan layar tidak pernah
 * membacanya lagi → blank permanen tanpa jalan keluar.
 *
 * Karena itu modul ini kini:
 *   1. OBSERVABLE — `subscribeOtpFlow` + snapshot agar layar ikut berubah
 *      begitu alur datang (bukan sekali baca).
 *   2. PUNYA status hidrasi eksplisit (`isOtpFlowHydrated`) sehingga layar
 *      bisa membedakan "masih memulihkan" dari "benar-benar tidak ada alur".
 *   3. TIDAK menimpa alur yang lebih baru saat hidrasi selesai belakangan —
 *      kejadian balapan lama yang bisa mengembalikan data basi.
 */
import type { OtpTriggerPurpose } from "@/lib/api/auth"
import { SecureKeys, deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage"

export type OtpFlowPurpose = OtpTriggerPurpose

export type OtpFlowState = {
  /** Nomor HP E.164 yang sedang diverifikasi. */
  phoneNumber: string
  /** Tujuan OTP — menentukan penanganan hasil di verify-otp. */
  purpose: OtpFlowPurpose
  /** Token migrasi (hanya purpose=migrate_phone) — untuk resend trigger. */
  migrationToken?: string
  /** Kode referensi trigger WhatsApp (12 hex) — mengikat pesan pemicu. */
  refCode?: string
  /** Deeplink wa.me dari backend — WAJIB lolos whitelist sebelum dibuka (B-08). */
  whatsappUrl?: string
  /** Teks pesan pemicu (fallback salin-manual bila deeplink ditolak). */
  triggerText?: string
  /** Kedaluwarsa trigger (ISO) — dokumentasi/polling. */
  expiresAt?: string
}

let state: OtpFlowState | null = null
/**
 * Selama `initOtpFlow()` belum selesai, `null` + "belum terhidrasi" berarti
 * "belum tahu", BUKAN "tidak ada alur". Layar wajib membedakan keduanya —
 * inilah akar layar blank: menyamakan "belum tahu" dengan "tidak ada".
 */
let hydrated = false
let hydration: Promise<void> | null = null

const listeners = new Set<() => void>()

/**
 * Langganan perubahan alur (dipakai `useOtpFlow`). Mengembalikan unsubscribe.
 * Snapshot yang dibaca adalah objek state itu sendiri — identitasnya berubah
 * hanya saat benar-benar ada perubahan, jadi aman untuk `useSyncExternalStore`.
 */
export function subscribeOtpFlow(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

function persist(): void {
  // Fire-and-forget: layar membaca dari memori yang sudah sinkron. Kegagalan
  // tulis tidak boleh menjatuhkan alur (paling buruk: tidak tahan restart).
  if (!state) return
  void setSecureItem(SecureKeys.otpFlow, JSON.stringify(state)).catch(() => {})
}

/** Mulai/timpa alur OTP (dipanggil sebelum navigasi ke whatsapp-trigger). */
export function setOtpFlow(next: OtpFlowState): void {
  state = { ...next }
  emit()
  persist()
}

/**
 * Perbarui sebagian alur (mis. hasil requestOtpTrigger saat kirim ulang).
 * `null`-safe: bila tidak ada alur aktif, tidak ada yang bisa ditambal —
 * pemanggil (layar) yang memutuskan apa yang harus dilakukan.
 */
export function patchOtpFlow(patch: Partial<OtpFlowState>): void {
  if (!state) return
  state = { ...state, ...patch }
  emit()
  persist()
}

/**
 * Baca alur aktif — `null` bila tidak ada (deep-link/reload tanpa alur).
 * Panggilan ini TIDAK memicu hidrasi; layar yang butuh menunggu pemulihan
 * wajib memakai `useOtpFlow()` (lib/use-otp-flow.ts) atau `initOtpFlow()`.
 */
export function getOtpFlow(): OtpFlowState | null {
  return state
}

/** Apakah pembacaan SecureStore awal sudah selesai (sukses maupun gagal)? */
export function isOtpFlowHydrated(): boolean {
  return hydrated
}

function isValidFlow(value: unknown): value is OtpFlowState {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<OtpFlowState>
  return typeof candidate.phoneNumber === "string" && typeof candidate.purpose === "string"
}

/**
 * Pulihkan alur OTP dari penyimpanan persisten (dipanggil sekali saat
 * startup aplikasi, sebelum layar auth dirender). Tanpa ini, restart di
 * tengah alur (umum di Android saat user pindah ke WhatsApp) membuat layar
 * whatsapp-trigger/verify-otp kehilangan state dan menampilkan layar putih.
 *
 * Idempoten & aman dipanggil berkali-kali (promise yang sama dibagikan) —
 * layar boleh memanggilnya sendiri sebagai jaring pemulihan tambahan.
 */
export function initOtpFlow(): Promise<void> {
  if (hydration) return hydration
  hydration = (async () => {
    try {
      const raw = await getSecureItem(SecureKeys.otpFlow)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isValidFlow(parsed)) {
          // JANGAN menimpa alur yang sudah ada di memori: pembacaan SecureStore
          // bisa selesai SETELAH pengguna memulai alur baru (mis. request trigger
          // kedua). State di memori selalu lebih baru daripada salinan disk.
          if (!state) {
            state = parsed
            emit()
          }
        } else {
          // Salinan rusak/usang → buang agar tidak dicoba lagi tiap boot.
          void deleteSecureItem(SecureKeys.otpFlow).catch(() => {})
        }
      }
    } catch {
      // Gagal baca = anggap tidak ada alur; layar flow-gate akan menampilkan
      // pesan + tombol kembali (bukan blank).
    } finally {
      hydrated = true
      emit()
    }
  })()
  return hydration
}

/** Hapus alur — setelah verifikasi sukses atau pengguna membatalkan. */
export function clearOtpFlow(): void {
  state = null
  emit()
  void deleteSecureItem(SecureKeys.otpFlow).catch(() => {})
}

/** Reset memori (dipakai test). */
export function resetOtpFlowForTest(): void {
  state = null
  hydrated = false
  hydration = null
  listeners.clear()
}
