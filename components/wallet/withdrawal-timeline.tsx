/**
 * Kahade — timeline status penarikan di detail mutasi (FE-IMP-4 item 8).
 *
 * Read-only: memetakan status mentah dari server ke tiga tahap yang mudah
 * dipahami — "Menunggu OTP" → "Diproses bank" → "Terkirim".
 *
 * TRX-006 (audit UI/UX 2026-09-28): kegagalan DIBEDAKAN, bukan disamaratakan.
 * Fakta backend (terverifikasi di wallet.service.ts): dompet DIDE BIT di
 * awal saat permintaan penarikan dibuat (balanceAfter = total - amount),
 * lalu dikembalikan (compensating credit) saat dibatalkan/kedaluwarsa. Jadi
 * klaim lama "Dana tidak terpotong" SALAH untuk CANCELLED/EXPIRED — dana
 * sempat ditahan lalu dikembalikan. Hint kini jujur per jenis kegagalan dan
 * tidak mengklaim absolut soal dana.
 */

import { View } from "react-native"
import { CheckCircle, CircleIcon as Circle, XCircle } from "phosphor-react-native"

import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"

type Phase = "otp" | "processing" | "done" | "failed" | "cancelled" | "unknown"

function phaseOf(status?: string | null): Phase {
  const s = (status ?? "").trim().toUpperCase()
  if (!s) return "unknown"
  if (s === "PENDING_OTP") return "otp"
  if (["PENDING", "PROCESSING", "PENDING_PROCESS", "PENDING_SETTLEMENT", "WAITING", "REVIEW"].includes(s))
    return "processing"
  if (["SUCCESS", "COMPLETED", "SETTLED", "APPROVED", "RELEASED"].includes(s)) return "done"
  // Dibatalkan pengguna = fase sendiri (bukan "gagal di bank").
  if (s === "CANCELLED") return "cancelled"
  if (["FAILED", "REJECTED", "EXPIRED"].includes(s)) return "failed"
  return "unknown"
}

/**
 * Judul + hint jujur per status mentah. Tidak ada klaim absolut "dana tidak
 * terpotong": untuk CANCELLED/EXPIRED dana sempat ditahan lalu dikembalikan
 * (compensating credit di backend); untuk FAILED posisi dana tidak bisa
 * dipastikan dari status saja — arahkan ke riwayat.
 */
function failureCopy(status?: string | null): { title: string; hint: string } {
  const s = (status ?? "").trim().toUpperCase()
  if (s === "CANCELLED") {
    return {
      title: "Penarikan dibatalkan",
      hint: "Dibatalkan sebelum diproses. Dana yang sempat ditahan sudah dikembalikan ke saldo — periksa riwayat.",
    }
  }
  if (s === "EXPIRED") {
    return {
      title: "Verifikasi kedaluwarsa",
      hint: "Kode verifikasi kedaluwarsa sebelum penarikan diproses. Dana yang sempat ditahan sudah dikembalikan ke saldo.",
    }
  }
  return {
    title: "Penarikan gagal",
    hint: "Penarikan tidak dapat diproses. Untuk kepastian status dana, periksa riwayat mutasi.",
  }
}

const STEPS = [
  { key: "otp", label: "Menunggu OTP", hint: "Verifikasi keamanan penarikan" },
  { key: "processing", label: "Diproses bank", hint: "Dana dikirim ke rekening tujuan" },
  { key: "done", label: "Terkirim", hint: "Dana sudah sampai di rekening" },
] as const

export function WithdrawalTimeline({ status }: { status?: string | null }) {
  const phase = phaseOf(status)
  const failed = phase === "failed" || phase === "cancelled"
  const failure = failed ? failureCopy(status) : null
  // Tahap gagal/dibatalkan ditampilkan sebagai "berhenti" di tahap yang
  // tercapai (best-effort: status saja tidak selalu tahu tahap pastinya —
  // hint-lah yang membawa penjelasan jujur, bukan posisi marker).
  const reachedIndex =
    phase === "done" ? 3 : phase === "processing" ? 1 : phase === "otp" ? 0 : failed ? 1 : -1

  return (
    <View
      className="gap-3 rounded-md border border-border bg-surface px-4 py-4"
      accessibilityRole="summary"
      accessibilityLabel="Timeline status penarikan"
    >
      <Text variant="body" weight={700}>
        Status penarikan
      </Text>
      <View className="gap-0">
        {STEPS.map((step, index) => {
          const isDone = index < reachedIndex || phase === "done"
          const isActive = index === reachedIndex && phase !== "done"
          const isFailedHere = failed && index === reachedIndex
          const isLast = index === STEPS.length - 1
          return (
            <View key={step.key} className="flex-row gap-3">
              <View className="items-center">
                <Icon
                  icon={isFailedHere ? XCircle : isDone ? CheckCircle : Circle}
                  size="md"
                  tone={isFailedHere ? "danger" : isDone || isActive ? "success" : "default"}
                  weight={isDone || isActive || isFailedHere ? "fill" : "regular"}
                />
                {!isLast ? (
                  // Garis penghubung: hijau untuk tahap yang sudah lewat.
                  <View
                    className={cn("w-0.5 flex-1", index < reachedIndex ? "bg-success" : "bg-border")}
                    style={{ minHeight: tokens.space[4] }}
                  />
                ) : null}
              </View>
              <View className="gap-0.5 pb-4">
                <Text
                  variant="body"
                  weight={isActive || isDone ? 700 : 400}
                  tone={isFailedHere ? "danger" : "primary"}
                >
                  {isFailedHere && failure ? failure.title : step.label}
                </Text>
                <Text variant="caption" tone="secondary">
                  {isFailedHere && failure ? failure.hint : step.hint}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
      {phase === "unknown" ? (
        <Text variant="caption" tone="secondary">
          Status penarikan belum diketahui — tarik untuk memuat ulang.
        </Text>
      ) : null}
    </View>
  )
}
