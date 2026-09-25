/**
 * R2 (audit ronde-2, butir #102/#103): batasan klien untuk DTO yang TIDAK
 * tercakup `API_CONSTRAINTS` (yang digenerate dari spec):
 *   - `PayOrderDto` ada di spec tetapi tanpa satu pun constraint key, sehingga
 *     generator tidak menurunkannya — padahal ini mutasi uang utama.
 *   - `EscalateDispute`/`WithdrawMutualResolution` tidak punya schema di spec
 *     sama sekali (body anonim inline di controller backend).
 *
 * Aturan di bawah dicocokkan dengan validasi yang SUDAH dipakai UI (PIN
 * persis 6 digit; alasan eskalasi minimal 10 karakter — lihat dialog
 * eskalasi di `app/dispute/[id].tsx`), jadi tidak ada permintaan yang
 * sebelumnya lolos UI lalu ditolak di sini. Withdraw tidak punya body →
 * memang tidak perlu entry.
 */
import type { Rules } from "@/lib/financial"

export const LOCAL_CONSTRAINTS = {
  /** PIN dompet: persis 6 digit angka (UI hanya menerima 6 digit). */
  PayOrderDto: {
    pin: { minLength: 6, maxLength: 6, pattern: "^\\d{6}$" },
  },
  /** Alasan eskalasi opsional; bila diisi minimal 10 karakter (sesuai dialog). */
  EscalateDisputeDto: {
    reason: { minLength: 10 },
  },
} as const satisfies Readonly<Record<string, Rules>>
