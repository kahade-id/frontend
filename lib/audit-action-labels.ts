/**
 * Kahade — label manusiawi untuk `UserAuditAction` backend (log keamanan &
 * log aktivitas di Perangkat & Log).
 *
 * Audit Pengaturan 2026-10-10: `GET /v1/users/me/security-log` dan
 * `/activity-log` mengirim `action` sebagai enum mentah (`PASSWORD_CHANGED`,
 * `ORDER_PAID`, …) dan layar menampilkannya apa adanya sebagai judul baris.
 * Enum backend tidak boleh bocor ke UI (§12) — peta ini mengubahnya menjadi
 * kalimat Indonesia (diterjemahkan lewat `translate`), dengan fallback
 * "Title case" untuk nilai baru yang belum dipetakan supaya tidak pernah
 * tampil `SNAKE_CASE`.
 *
 * Literal ditulis langsung di dalam `translate()` (bukan tabel) agar
 * generator katalog i18n memungutnya.
 */
import type { SecurityLogKind } from "@/components/ui/security-log-item"
import { translate } from "@/lib/i18n/translate"

/** Fallback: `ORDER_SHIPPING_UPDATED` → "Order shipping updated". */
function prettify(action: string): string {
  const words = action.trim().toLowerCase().replace(/_+/g, " ")
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : translate("Aktivitas")
}

/** Judul baris log KEAMANAN (subset `SECURITY_ACTIONS` di users.service.ts). */
export function securityActionLabel(action: string): string {
  switch (action) {
    case "LOGIN":
      return translate("Masuk ke akun")
    case "LOGOUT":
      return translate("Keluar dari akun")
    case "LOGOUT_ALL":
      return translate("Keluar dari semua perangkat")
    case "PASSWORD_CHANGED":
      return translate("Kata sandi diubah")
    case "PASSWORD_RESET":
      return translate("Kata sandi direset")
    case "TWO_FA_ENABLED":
      return translate("Verifikasi dua langkah diaktifkan")
    case "TWO_FA_DISABLED":
      return translate("Verifikasi dua langkah dimatikan")
    case "EMAIL_VERIFIED":
      return translate("Email diverifikasi")
    case "DEVICE_TRUSTED":
      return translate("Perangkat ditandai tepercaya")
    case "DEVICE_UNTRUSTED":
      return translate("Kepercayaan perangkat dicabut")
    default:
      return activityActionLabel(action)
  }
}

/** Ikon baris log keamanan — mengikuti `SecurityLogKind` komponen. */
export function securityActionKind(action: string): SecurityLogKind {
  switch (action) {
    case "LOGOUT":
    case "LOGOUT_ALL":
      return "logout"
    case "PASSWORD_CHANGED":
    case "PASSWORD_RESET":
      return "passwordChange"
    case "TWO_FA_ENABLED":
      return "twoFactorEnabled"
    case "TWO_FA_DISABLED":
      return "twoFactorDisabled"
    case "DEVICE_TRUSTED":
    case "DEVICE_UNTRUSTED":
      return "newDevice"
    default:
      return "login"
  }
}

/** Judul baris log AKTIVITAS (seluruh enum `UserAuditAction`). */
export function activityActionLabel(action: string): string {
  switch (action) {
    case "REGISTER":
      return translate("Akun dibuat")
    case "LOGIN":
      return translate("Masuk ke akun")
    case "SOCIAL_LOGIN":
      return translate("Masuk dengan akun sosial")
    case "LOGOUT":
      return translate("Keluar dari akun")
    case "LOGOUT_ALL":
      return translate("Keluar dari semua perangkat")
    case "PASSWORD_CHANGED":
      return translate("Kata sandi diubah")
    case "PASSWORD_RESET":
      return translate("Kata sandi direset")
    case "TWO_FA_ENABLED":
      return translate("Verifikasi dua langkah diaktifkan")
    case "TWO_FA_DISABLED":
      return translate("Verifikasi dua langkah dimatikan")
    case "EMAIL_VERIFIED":
      return translate("Email diverifikasi")
    case "PROFILE_UPDATED":
      return translate("Profil diperbarui")
    case "AVATAR_UPDATED":
      return translate("Foto profil diperbarui")
    case "USERNAME_SET":
      return translate("Username diatur")
    case "ACCOUNT_DELETION_REQUESTED":
      return translate("Penghapusan akun diminta")
    case "KYC_SUBMITTED":
      return translate("Verifikasi identitas dikirim")
    case "BUSINESS_VERIFICATION_SUBMITTED":
      return translate("Verifikasi badan usaha dikirim")
    case "ORDER_CREATED":
      return translate("Transaksi dibuat")
    case "ORDER_CONFIRMED":
      return translate("Transaksi dikonfirmasi")
    case "ORDER_REJECTED":
      return translate("Transaksi ditolak")
    case "ORDER_PAID":
      return translate("Transaksi dibayar")
    case "ORDER_PROCESSED":
      return translate("Transaksi diproses")
    case "ORDER_SHIPPING_UPDATED":
      return translate("Info pengiriman diperbarui")
    case "ORDER_COMPLETED":
      return translate("Transaksi selesai")
    case "ORDER_CANCELLED":
      return translate("Transaksi dibatalkan")
    case "ORDER_DISPUTE_SUBMITTED":
      return translate("Sengketa diajukan")
    case "ORDER_EXTENSION_REQUESTED":
      return translate("Perpanjangan waktu diminta")
    case "ORDER_EXTENSION_RESPONDED":
      return translate("Perpanjangan waktu dijawab")
    case "ORDER_DELIVERED":
      return translate("Pesanan dikirim")
    case "ORDER_DELIVERY_CONFIRMED":
      return translate("Penerimaan pesanan dikonfirmasi")
    case "TOPUP_INITIATED":
      return translate("Isi saldo dimulai")
    case "TOPUP_CANCELLED":
      return translate("Isi saldo dibatalkan")
    case "WITHDRAW_REQUESTED":
      return translate("Penarikan dana diminta")
    case "WITHDRAW_CONFIRMED":
      return translate("Penarikan dana dikonfirmasi")
    case "WITHDRAW_CANCELLED":
      return translate("Penarikan dana dibatalkan")
    case "TRANSFER_SENT":
      return translate("Transfer dikirim")
    case "TRANSFER_RECEIVED":
      return translate("Transfer diterima")
    case "BANK_ACCOUNT_ADDED":
      return translate("Rekening bank ditambahkan")
    case "BANK_ACCOUNT_DELETED":
      return translate("Rekening bank dihapus")
    case "BANK_ACCOUNT_PRIMARY_SET":
      return translate("Rekening utama diatur")
    case "USER_BLOCKED":
      return translate("Pengguna diblokir")
    case "USER_UNBLOCKED":
      return translate("Blokir pengguna dibuka")
    case "USER_REPORTED":
      return translate("Pengguna dilaporkan")
    case "SHOWCASE_REPORTED":
      return translate("Etalase dilaporkan")
    case "NOTIFICATION_PREF_UPDATED":
      return translate("Preferensi notifikasi diubah")
    case "PRIVACY_SETTINGS_UPDATED":
      return translate("Pengaturan privasi diubah")
    case "CONSENT_GRANTED":
      return translate("Persetujuan diberikan")
    case "CONSENT_REVOKED":
      return translate("Persetujuan ditarik")
    case "DATA_EXPORT_REQUESTED":
      return translate("Salinan data diminta")
    case "DATA_EXPORT_DOWNLOADED":
      return translate("Salinan data diunduh")
    case "SUBSCRIPTION_STARTED":
      return translate("Langganan dimulai")
    case "SUBSCRIPTION_CANCELLED":
      return translate("Langganan dibatalkan")
    case "SUBSCRIPTION_AUTO_RENEW_TOGGLED":
      return translate("Perpanjangan otomatis diubah")
    case "REFERRAL_CODE_APPLIED":
      return translate("Kode referral dipakai")
    case "RATING_SUBMITTED":
      return translate("Ulasan dikirim")
    case "DISPUTE_EVIDENCE_ADDED":
      return translate("Bukti sengketa ditambahkan")
    case "DISPUTE_EVIDENCE_DELETED":
      return translate("Bukti sengketa dihapus")
    case "ORDER_LINK_CREATED":
      return translate("Tautan transaksi dibuat")
    case "ORDER_LINK_ACCEPTED":
      return translate("Tautan transaksi diterima")
    case "DEVICE_TRUSTED":
      return translate("Perangkat ditandai tepercaya")
    case "DEVICE_UNTRUSTED":
      return translate("Kepercayaan perangkat dicabut")
    case "PASSKEY_REGISTERED":
      return translate("Passkey didaftarkan")
    case "PASSKEY_USED":
      return translate("Masuk dengan passkey")
    case "PASSKEY_FAILED":
      return translate("Passkey gagal dipakai")
    case "PASSKEY_REVOKED":
      return translate("Passkey dihapus")
    case "PASSKEY_RENAMED":
      return translate("Nama passkey diubah")
    case "SOCIAL_PROVIDER_LINKED":
      return translate("Akun sosial ditautkan")
    case "SOCIAL_PROVIDER_UNLINKED":
      return translate("Tautan akun sosial dilepas")
    default:
      return prettify(action)
  }
}
