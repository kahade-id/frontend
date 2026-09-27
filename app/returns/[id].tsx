/**
 * Screen — Detail Retur (GAP-D G207–G217, G224).
 * GET /v1/returns/[id] · timeline purnajual · negosiasi dua pihak ·
 * aksi buyer/seller sesuai status.
 */
import { useState } from "react"
import { Text, TextInput, View, Alert } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import type { ReturnDetail } from "@/lib/api/returns"
import {
  RETURN_STATUS_LABEL,
  RETURN_REASON_LABEL,
  RETURN_RESOLUTION_LABEL,
  formatIdrSen,
  returnIdShort,
} from "@/lib/api/returns"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"

function Timeline({ detail, dot, muted }: { detail: ReturnDetail; dot: string; muted: string }) {
  return (
    <View style={{ gap: tokens.space[2] }}>
      {(detail.timeline ?? []).map((t) => (
        <View key={t.id} style={{ flexDirection: "row", gap: tokens.space[2] }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>
              {t.toStatus ? (RETURN_STATUS_LABEL[t.toStatus as keyof typeof RETURN_STATUS_LABEL] ?? t.toStatus) : t.event}
            </Text>
            <Text style={{ color: muted, fontSize: 12 }}>
              {formatDateTime(t.createdAt)} · {t.actorRole}
            </Text>
          </View>
        </View>
      ))}
      {(detail.timeline ?? []).length === 0 ? (
        <Text style={{ color: muted }}>Belum ada riwayat.</Text>
      ) : null}
    </View>
  )
}

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  const c = tokens.colors[mode]
  const warningText = tokens.colors.semantic.warning[mode].text
  const [note, setNote] = useState("")
  const [tracking, setTracking] = useState("")
  const [mutating, setMutating] = useState(false)
  const query = useApiQuery<ReturnDetail>(
    `return:${String(id)}`,
    (signal) => api.returns.getReturn(String(id), signal),
    !!id,
    { refreshOnFocus: true },
  )
  const detail = query.data

  async function run(label: string, fn: () => Promise<unknown>, confirmMsg?: string) {
    const go = async () => {
      setMutating(true)
      try {
        await fn()
        await query.reload()
      } catch (e) {
        if (
          showMutationError(toast.show, {
            failTitle: `Gagal: ${label}`,
            uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
            err: e,
          })
        ) {
          await query.reload()
        }
      } finally {
        setMutating(false)
      }
    }
    if (confirmMsg) {
      Alert.alert(label, confirmMsg, [{ text: "Batal" }, { text: "Ya", onPress: go }])
    } else {
      await go()
    }
  }

  return (
    <DataScreen title="Detail Retur" state={query} loadingMessage="Memuat detail retur…">
      {detail ? (
        <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>{returnIdShort(detail)}</Text>
              <Badge>{RETURN_STATUS_LABEL[detail.status]}</Badge>
            </View>
            <Text style={{ marginTop: tokens.space[2] }}>{RETURN_REASON_LABEL[detail.reasonCode]}</Text>
            {detail.reasonDetail ? <Text style={{ color: c.textTertiary }}>{detail.reasonDetail}</Text> : null}
            {detail.resolutionType ? (
              <Text style={{ marginTop: tokens.space[1] }}>
                Penyelesaian: {RETURN_RESOLUTION_LABEL[detail.resolutionType]}
                {detail.refundAmount != null ? ` · ${formatIdrSen(detail.refundAmount)}` : ""}
              </Text>
            ) : null}
            {detail.sellerRespondBy && (detail.status === "REQUESTED" || detail.status === "SELLER_REVIEW") ? (
              <Text style={{ color: warningText, marginTop: tokens.space[1] }}>
                Penjual harus merespons sebelum {formatDateTime(detail.sellerRespondBy)}
              </Text>
            ) : null}
          </Card>

          {detail.returnInstructions ? (
            <Card>
              <SectionHeader title="Instruksi pengiriman balik" />
              <Text>{detail.returnInstructions}</Text>
              {detail.shipBy ? (
                <Text style={{ color: c.textTertiary, marginTop: tokens.space[1] }}>
                  Kirim sebelum {formatDateTime(detail.shipBy)}
                </Text>
              ) : null}
              {detail.returnTrackingNumber ? (
                <Text style={{ marginTop: tokens.space[1] }}>
                  Resi retur: {detail.returnTrackingNumber}
                  {detail.returnCourier ? ` (${detail.returnCourier})` : ""}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {detail.status === "APPROVED" ? (
            <Card>
              <SectionHeader title="Kirim barang retur" />
              <TextInput
                value={tracking}
                onChangeText={setTracking}
                placeholder="Nomor resi pengiriman balik"
                placeholderTextColor={c.textTertiary}
                style={{ borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md, padding: tokens.space[3], color: c.textPrimary }}
              />
              <View style={{ marginTop: tokens.space[2] }}>
                <Button
                  disabled={!tracking.trim() || mutating}
                  onPress={() => run("Kirim resi", () => api.returns.submitReturnTracking(detail.id, { trackingNumber: tracking.trim() }))}
                >
                  Kirim Resi
                </Button>
              </View>
            </Card>
          ) : null}

          <Card>
            <SectionHeader title="Negosiasi" />
            <View style={{ gap: tokens.space[2] }}>
              {(detail.notes ?? []).map((n) => (
                <View key={n.id} style={{ backgroundColor: c.surface, borderRadius: tokens.radius.md, padding: tokens.space[2] }}>
                  <Text style={{ fontSize: 12, color: c.textTertiary }}>{n.authorRole} · {formatDateTime(n.createdAt)}</Text>
                  <Text>{n.message}</Text>
                </View>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Tulis pesan untuk pihak lain…"
              placeholderTextColor={c.textTertiary}
              style={{ borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md, padding: tokens.space[3], color: c.textPrimary, marginTop: tokens.space[2] }}
            />
            <View style={{ marginTop: tokens.space[2] }}>
              <Button
                disabled={!note.trim() || mutating}
                onPress={() => run("Kirim pesan", async () => { await api.returns.addReturnNote(detail.id, { message: note.trim() }); setNote("") })}
              >
                Kirim Pesan
              </Button>
            </View>
          </Card>

          <Card>
            <SectionHeader title="Riwayat" />
            <Timeline detail={detail} dot={c.primary} muted={c.textTertiary} />
          </Card>

          <View style={{ gap: tokens.space[2] }}>
            {["REQUESTED", "SELLER_REVIEW", "CLARIFICATION_NEEDED"].includes(detail.status) ? (
              <Button
                variant="secondary"
                onPress={() => run("Batalkan", () => api.returns.cancelReturn(detail.id), "Batalkan pengajuan retur ini?")}
              >
                Batalkan Pengajuan
              </Button>
            ) : null}
            {detail.status === "RETURN_SHIPPING" ? (
              <Button
                onPress={() => run("Konfirmasi terima", () => api.returns.confirmReturnReceived(detail.id))}
              >
                Konfirmasi Barang Diterima (Penjual)
              </Button>
            ) : null}
            {!["RESOLVED_REFUND", "RESOLVED_EXCHANGE", "RESOLVED_REPAIR", "ESCALATED", "CANCELLED", "EXPIRED", "REJECTED"].includes(detail.status) ? (
              <Button
                variant="secondary"
                onPress={() => run("Eskalasi", () => api.returns.escalateReturn(detail.id), "Eskalasi ke sengketa? Kasus sengketa yang sudah ada akan dipakai ulang.")}
              >
                Eskalasi ke Sengketa
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </DataScreen>
  )
}
