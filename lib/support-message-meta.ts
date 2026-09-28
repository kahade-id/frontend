/**
 * Kahade — label peran pengirim + stempel waktu pesan dukungan
 * (batch 139, item F16).
 *
 * Balasan pengguna, bot, dan agen sebelumnya sulit dibedakan; waktu hanya
 * tampil relatif. Modul murni ini menentukan:
 * - peran: "user" (Anda) / "bot" (Asisten Otomatis) / "agent" (Tim Kahade)
 * - waktu: relatif ("5 menit lalu") yang bisa diketuk → absolut
 *   ("28 Sep 2026, 14:05")
 *
 * Keterbatasan jujur: payload pesan backend hanya membawa `fromUser`
 * (boolean). Field `isBot`/`senderRole` dibaca toleran bila suatu saat ada;
 * tanpa itu pesan masuk dilabeli "Tim Kahade" (agen) — pengecualian:
 * sapaan otomatis live support yang memang dilabeli bot oleh klien.
 */
import { formatDateTime, formatRelativeTime } from "@/lib/format"

export type SupportSenderRole = "user" | "bot" | "agent"

export const SUPPORT_ROLE_LABEL: Record<SupportSenderRole, string> = {
  user: "Anda",
  bot: "Asisten Otomatis",
  agent: "Tim Kahade",
}

export function supportRoleLabel(role: SupportSenderRole): string {
  return SUPPORT_ROLE_LABEL[role]
}

type RawMessage = {
  fromUser?: boolean
  isBot?: boolean
  senderRole?: string
  [k: string]: unknown
}

/**
 * Tentukan peran dari payload pesan mentah. `forceBot` dipakai untuk pesan
 * yang memang dibuat klien sebagai sapaan bot (live support).
 */
export function resolveSupportSenderRole(raw: RawMessage, forceBot = false): SupportSenderRole {
  if (forceBot) return "bot"
  if (raw.fromUser === true) return "user"
  if (raw.isBot === true) return "bot"
  const sr = typeof raw.senderRole === "string" ? raw.senderRole.toLowerCase() : ""
  if (sr === "bot" || sr === "assistant") return "bot"
  return "agent"
}

/** Waktu relatif siap tampil, mis. "5 menit lalu". */
export function supportMessageRelativeTime(createdAt: string | number | Date): string {
  return formatRelativeTime(createdAt)
}

/** Waktu absolut siap tampil, mis. "28 Sep 2026, 14:05". */
export function supportMessageAbsoluteTime(createdAt: string | number | Date): string {
  return formatDateTime(createdAt)
}
