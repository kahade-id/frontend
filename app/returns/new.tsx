/**
 * Screen — Ajukan Retur (GAP-D G203–G206).
 * POST /v1/returns · jendela pengajuan & deadline dihitung server (G206).
 * Dipanggil dengan query ?orderId=...
 */
import { useState } from "react"
import { View, Pressable } from "react-native"
import { Package } from "phosphor-react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { ReturnEligibility, ReturnReasonCode } from "@/lib/api/returns"
import { RETURN_REASON_LABEL } from "@/lib/api/returns"
import { formatDateTimeWIB } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"

const REASONS: ReturnReasonCode[] = [
  "BARANG_RUSAK",
  "BARANG_TIDAK_SESUAI_DESKRIPSI",
  "BARANG_TIDAK_LENGKAP",
  "BARANG_PALSU",
  "SALAH_KIRIM_VARIAN",
  "BARANG_KEDALUWARSA",
  "KEMASAN_RUSAK_PARAH",
  "LAINNYA",
]

export default function NewReturnScreen() {
  const router = useRouter()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  const c = tokens.colors[mode]
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("BARANG_RUSAK")
  const [reasonDetail, setReasonDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const eligQuery = useApiQuery<ReturnEligibility>(
    `return-eligibility:${String(orderId)}`,
    (signal) => api.returns.getReturnEligibility(String(orderId), signal),
    !!orderId,
  )
  const elig = eligQuery.data

  async function submit() {
    if (!orderId || submitting) return
    setSubmitting(true)
    try {
      const created = await api.returns.createReturn({
        orderId: String(orderId),
        reasonCode,
        reasonDetail: reasonDetail.trim() || undefined,
      })
      router.replace(ROUTES.returnDetail(created.id))
    } catch (e) {
      showMutationError(toast.show, {
        failTitle: "Gagal mengajukan retur",
        uncertainHint: "Pengajuan mungkin sudah terkirim — periksa daftar retur sebelum mencoba lagi.",
        err: e,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // UI-T007 (audit UI/UX 2026-09-27): orderId hilang (mis. deep link cacat)
  // tidak boleh menghasilkan layar kosong — tampilkan empty state eksplisit.
  if (!orderId) {
    return (
      <Screen edges={["top", "bottom"]} padded>
        <Header title="Ajukan Retur" />
        <EmptyState
          icon={Package}
          title="Pesanan tidak ditemukan"
          description="Tautan retur tidak valid. Buka kembali dari detail pesanan Anda."
          action={
            <Button variant="secondary" onPress={() => router.back()}>
              Kembali
            </Button>
          }
        />
      </Screen>
    )
  }

  return (
    <DataScreen title="Ajukan Retur" state={eligQuery} loadingMessage="Memeriksa syarat retur…">
      {elig ? (
        !elig.eligible ? (
          <View style={{ paddingVertical: tokens.space[4] }}>
            <SectionHeader title="Tidak dapat mengajukan retur" />
            <Text tone="secondary">{elig.reason ?? "Pesanan ini tidak memenuhi syarat retur."}</Text>
          </View>
        ) : (
          <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
            {elig.deadlineAt ? (
              <Text tone="secondary">
                Batas pengajuan: {formatDateTimeWIB(elig.deadlineAt)} (dihitung server)
              </Text>
            ) : null}
            <View>
              <SectionHeader title="Alasan retur" />
              <View style={{ gap: tokens.space[2] }}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setReasonCode(r)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Alasan: ${RETURN_REASON_LABEL[r]}`}
                    accessibilityState={{ checked: reasonCode === r }}
                    style={{
                      padding: tokens.space[3],
                      borderRadius: tokens.radius.md,
                      borderWidth: 1,
                      borderColor: reasonCode === r ? c.primary : c.borderDefault,
                      // Tidak ada token "primarySoft": tint 8% dari primary.
                      backgroundColor: reasonCode === r ? `${c.primary}14` : c.surface,
                    }}
                  >
                    <Text weight={reasonCode === r ? 700 : 400}>{RETURN_REASON_LABEL[r]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TextArea
              label="Deskripsi (opsional)"
              value={reasonDetail}
              onChangeText={setReasonDetail}
              placeholder="Jelaskan kondisi barang…"
              rows={4}
              helperText="Foto kondisi barang dapat ditambahkan setelah pengajuan dibuat, di halaman detail retur."
              accessibilityLabel="Deskripsi alasan retur"
            />
            {/* UI-T017 (audit UI/UX 2026-09-27): prop loading — spinner +
                anti double-submit; label tidak berganti-ganti. */}
            <Button onPress={submit} loading={submitting}>
              Ajukan Retur
            </Button>
          </View>
        )
      ) : null}
    </DataScreen>
  )
}
