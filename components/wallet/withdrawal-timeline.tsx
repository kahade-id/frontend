/**
 * Kahade — timeline status penarikan di detail mutasi (FE-IMP-4 item 8).
 *
 * Read-only: memetakan status mentah dari server ke tiga tahap yang mudah
 * dipahami — "Menunggu OTP" → "Diproses bank" → "Terkirim". Gagal (FAILED /
 * REJECTED / CANCELLED / EXPIRED) ditandai merah di tahap tercapai.
 * Pull-to-refresh layar detail sudah ada, jadi timeline selalu segar.
 */

import { View } from "react-native"
import { CheckCircle, Circle, XCircle } from "phosphor-react-native"

import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"

type Phase = "otp" | "processing" | "done" | "failed" | "unknown"

function phaseOf(status?: string | null): Phase {
  const s = (status ?? "").trim().toUpperCase()
  if (!s) return "unknown"
  if (s === "PENDING_OTP") return "otp"
  if (["PENDING", "PROCESSING", "PENDING_PROCESS", "PENDING_SETTLEMENT", "WAITING", "REVIEW"].includes(s))
    return "processing"
  if (["SUCCESS", "COMPLETED", "SETTLED", "APPROVED", "RELEASED"].includes(s)) return "done"
  if (["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(s)) return "failed"
  return "unknown"
}

const STEPS = [
  { key: "otp", label: "Menunggu OTP", hint: "Verifikasi keamanan penarikan" },
  { key: "processing", label: "Diproses bank", hint: "Dana dikirim ke rekening tujuan" },
  { key: "done", label: "Terkirim", hint: "Dana sudah sampai di rekening" },
] as const

export function WithdrawalTimeline({ status }: { status?: string | null }) {
  const phase = phaseOf(status)
  // Tahap gagal ditampilkan sebagai "berhenti" di tahap yang tercapai.
  const reachedIndex =
    phase === "done" ? 3 : phase === "processing" ? 1 : phase === "otp" ? 0 : phase === "failed" ? 1 : -1

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
          const isFailedHere = phase === "failed" && index === reachedIndex
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
                  {step.label}
                  {isFailedHere ? " — gagal" : ""}
                </Text>
                <Text variant="caption" tone="secondary">
                  {isFailedHere
                    ? "Penarikan tidak dapat diproses. Dana tidak terpotong — periksa riwayat."
                    : step.hint}
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
