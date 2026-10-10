/**
 * Kahade — identitas pengirim untuk gelembung MASUK (audit Pesan 2026-10-10, #1).
 *
 * Masalah: baris chat selalu memasang foto + nama LAWAN BICARA pada setiap
 * pesan masuk. Di ruang transaksi/sengketa admin Kahade ikut masuk, dan
 * pesannya tampil dengan nama + foto lawan bicara — pembaca mengira
 * instruksi admin datang dari penjual/pembeli (celah penipuan sosial).
 *
 * Aturan (murni, diuji di tests/chat-sender-identity.test.ts):
 *   - Identitas tidak ditampilkan (null) bila pemanggil menyembunyikannya
 *     (DM 1:1 ala WhatsApp), untuk pesan keluar, dan pesan sistem.
 *   - Bila payload membawa `sender` (BFI-136: `{ id, userId, fullName,
 *     avatarUrl }`) dengan nama, itulah sumber kebenaran — foto ikut dari
 *     sender (bukan dari lawan bicara) walau kosong.
 *   - Seal verifikasi HANYA dipasang bila pengirim memang lawan bicara
 *     (id/userId cocok). Admin tidak mewarisi badge penjual.
 *   - Tanpa `sender` (payload lama / optimistis) → jatuh ke lawan bicara,
 *     perilaku lama.
 */
import type { ChatMessage } from "@/lib/api/chat"
import type { SealTier } from "@/components/ui/verified-seal"

export type CounterpartIdentity = {
  id?: string | null
  name?: string | null
  avatarUrl?: string | null
  sealTier?: SealTier | null
}

export type IncomingSenderIdentity = {
  name?: string
  avatarUrl?: string | null
  sealTier: SealTier | null
}

function cleanName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

/** True bila `sender` adalah lawan bicara ruang (bukan admin/pihak ketiga). */
export function isSenderCounterpart(
  sender: ChatMessage["sender"] | null | undefined,
  counterpartId: string | null | undefined,
): boolean {
  if (!sender || !counterpartId) return false
  const target = counterpartId.trim()
  if (!target) return false
  return [sender.userId, sender.id].some(
    (v) => typeof v === "string" && v.trim() === target,
  )
}

/**
 * Identitas yang dipasang bubble untuk pesan `message`. `null` = tanpa
 * kolom avatar/nama (lihat aturan di header berkas).
 */
export function resolveIncomingSenderIdentity(
  message: Pick<ChatMessage, "fromUser" | "messageType" | "sender">,
  counterpart: CounterpartIdentity | null | undefined,
  showSenderIdentity: boolean,
): IncomingSenderIdentity | null {
  if (!showSenderIdentity || message.fromUser || message.messageType === "SYSTEM") return null
  const senderName = cleanName(message.sender?.fullName)
  if (senderName) {
    const fromCounterpart = isSenderCounterpart(message.sender, counterpart?.id)
    return {
      name: senderName,
      avatarUrl: message.sender?.avatarUrl ?? null,
      sealTier: fromCounterpart ? (counterpart?.sealTier ?? null) : null,
    }
  }
  if (!counterpart) return null
  return {
    name: cleanName(counterpart.name),
    avatarUrl: counterpart.avatarUrl ?? null,
    sealTier: counterpart.sealTier ?? null,
  }
}
