/**
 * Kahade — token migrasi nomor HP tertunda (Login sosial → Migrasi HP).
 *
 * `POST /v1/auth/social/login` mengembalikan `{ requiresPhoneMigration: true,
 * migrationToken }` bila akun belum punya nomor HP. Token dipakai untuk
 * `requestOtpTrigger` (purpose migrate_phone) lalu disimpan di otp-flow untuk
 * resend.
 *
 * Disimpan di memori modul — pola yang SAMA dengan lib/two-factor-login.ts:
 * token berumur pendek TIDAK boleh lewat route params (muncul di URL/deeplink
 * web). BATCH4-B4.
 *
 * Hilang saat app di-restart — user mengulang login sosial (fail-closed).
 */

let pendingMigrationToken: string | null = null

export function setPendingMigrationToken(token: string): void {
  pendingMigrationToken = token
}

export function getPendingMigrationToken(): string | null {
  return pendingMigrationToken
}

export function clearPendingMigrationToken(): void {
  pendingMigrationToken = null
}
