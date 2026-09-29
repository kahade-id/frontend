/**
 * Screen — Detail Retur (GAP-D G207–G217, G224).
 * GET /v1/returns/[id] · timeline purnajual · negosiasi dua pihak ·
 * aksi buyer/seller sesuai status.
 */
import { useState } from "react"
import { Text, TextInput, View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import type { ReturnDetail } from "@/lib/api/returns"
import {
  RETURN_STATUS_LABEL,
  RETURN_REASON_LABEL,
  RETURN_RESOLUTION_LABEL,
  RETURN_ACTOR_ROLE_LABEL,
  formatIdrSen,
  returnIdShort,
} from "@/lib/api/returns"
import { formatDateTime, formatDateTimeWIB } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
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
              {formatDateTime(t.createdAt)} · {RETURN_ACTOR_ROLE_LABEL[t.actorRole] ?? t.actorRole}
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
  /** T4-010: dialog konfirmasi batal retur (menggantikan Alert.alert). */
  const [cancelOpen, setCancelOpen] = useState(false)
  /** FE-054: dialog konfirmasi eskalasi ke sengketa (menggantikan Alert.alert "Ya" ambigu). */
  const [escalateOpen, setEscalateOpen] = useState(false)
  const query = useApiQuery<ReturnDetail>(
    `return:${String(id)}`,
    (signal) => api.returns.getReturn(String(id), signal),
    !!id,
    { refreshOnFocus: true },
  )
  const detail = query.data

  async function run(
    failTitle: string,
    fn: () => Promise<unknown>,
    opts?: {
      /** T4-009: toast sukses setelah aksi berhasil (mis. "Resi terkirim"). */
      successTitle?: string
    },
  ) {
    const go = async () => {
      setMutating(true)
      try {
        await fn()
        if (opts?.successTitle) toast.show({ title: opts.successTitle, tone: "success" })
        await query.reload()
      } catch (e) {
        if (
          showMutationError(toast.show, {
            // UI-T016 (audit UI/UX 2026-09-27): failTitle kini frasa utuh
            // ("Gagal mengirim resi"), bukan "Gagal: <verba>".
            failTitle,
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
    // FE-054: jalur konfirmasi Alert.alert lama dihapus — eskalasi kini
    // memakai <Dialog> bermerek (state `escalateOpen`).
    await go()
  }

  return (
    <DataScreen title="Detail Retur" state={query} loadingMessage="Memuat detail retur…">
      {detail ? (
        <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>{returnIdShort(detail)}</Text>
              <Badge>{RETURN_STATUS_LABEL[detail.status] ?? detail.status}</Badge>
            </View>
            <Text style={{ marginTop: tokens.space[2] }}>{RETURN_REASON_LABEL[detail.reasonCode] ?? detail.reasonCode}</Text>
            {detail.reasonDetail ? <Text style={{ color: c.textTertiary }}>{detail.reasonDetail}</Text> : null}
            {detail.resolutionType ? (
              <Text style={{ marginTop: tokens.space[1] }}>
                Penyelesaian: {detail.resolutionType ? (RETURN_RESOLUTION_LABEL[detail.resolutionType] ?? detail.resolutionType) : "—"}
                {detail.refundAmount != null ? ` · ${formatIdrSen(detail.refundAmount)}` : ""}
              </Text>
            ) : null}
            {detail.sellerRespondBy && (detail.status === "REQUESTED" || detail.status === "SELLER_REVIEW") ? (
              <Text style={{ color: warningText, marginTop: tokens.space[1] }}>
                Penjual harus merespons sebelum {formatDateTimeWIB(detail.sellerRespondBy)}
              </Text>
            ) : null}
          </Card>

          {detail.returnInstructions ? (
            <Card>
              <SectionHeader title="Instruksi pengiriman balik" />
              <Text>{detail.returnInstructions}</Text>
              {detail.shipBy ? (
                <Text style={{ color: c.textTertiary, marginTop: tokens.space[1] }}>
                  Kirim sebelum {formatDateTimeWIB(detail.shipBy)}
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
                accessibilityLabel="Nomor resi pengiriman balik"
                placeholderTextColor={c.textTertiary}
                style={{ borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md, padding: tokens.space[3], color: c.textPrimary }}
              />
              <View style={{ marginTop: tokens.space[2] }}>
                <Button
                  disabled={!tracking.trim() || mutating}
                  loading={mutating}
                  onPress={() =>
                    run(
                      "Gagal mengirim resi",
                      () => api.returns.submitReturnTracking(detail.id, { trackingNumber: tracking.trim() }),
                      { successTitle: "Resi terkirim" },
                    )
                  }
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
                  <Text style={{ fontSize: 12, color: c.textTertiary }}>{RETURN_ACTOR_ROLE_LABEL[n.authorRole] ?? n.authorRole} · {formatDateTime(n.createdAt)}</Text>
                  <Text>{n.message}</Text>
                </View>
              ))}
              {/* UI-T006 (audit UI/UX 2026-09-27): empty state eksplisit saat
                  belum ada pesan — sebelumnya kartu Negosiasi tampil kosong. */}
              {(detail.notes ?? []).length === 0 ? (
                <Text style={{ color: c.textTertiary }}>Belum ada pesan.</Text>
              ) : null}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Tulis pesan untuk pihak lain…"
              accessibilityLabel="Pesan negosiasi"
              placeholderTextColor={c.textTertiary}
              style={{ borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md, padding: tokens.space[3], color: c.textPrimary, marginTop: tokens.space[2] }}
            />
            <View style={{ marginTop: tokens.space[2] }}>
              <Button
                disabled={!note.trim() || mutating}
                loading={mutating}
                onPress={() =>
                  run(
                    "Gagal mengirim pesan",
                    async () => {
                      await api.returns.addReturnNote(detail.id, { message: note.trim() })
                      setNote("")
                    },
                    { successTitle: "Pesan terkirim" },
                  )
                }
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
                loading={mutating}
                onPress={() => setCancelOpen(true)}
              >
                Batalkan Pengajuan
              </Button>
            ) : null}
            {detail.status === "RETURN_SHIPPING" ? (
              <Button
                loading={mutating}
                onPress={() => run("Gagal mengonfirmasi penerimaan", () => api.returns.confirmReturnReceived(detail.id))}
              >
                Konfirmasi Barang Diterima (Penjual)
              </Button>
            ) : null}
            {!["RESOLVED_REFUND", "RESOLVED_EXCHANGE", "RESOLVED_REPAIR", "ESCALATED", "CANCELLED", "EXPIRED", "REJECTED"].includes(detail.status) ? (
              <Button
                variant="secondary"
                loading={mutating}
                onPress={() => setEscalateOpen(true)}
              >
                Eskalasi ke Sengketa
              </Button>
            ) : null}
          </View>

          {/*
            T4-010 (audit UI/UX intuitif 2026-09-29): konfirmasi pembatalan
            memakai <Dialog> bermerek dengan konsekuensi eksplisit, bukan
            Alert.alert. Fakta backend (returns.service.ts `buyerCancel`):
            status → CANCELLED, penjual diberi tahu; dana/order tidak
            bergerak (retur tidak mengubah status order); pengajuan ulang
            bisa selama masih dalam masa retur (cek duplikat hanya menolak
            retur AKTIF).
          */}
          <Dialog
            visible={cancelOpen}
            onRequestClose={() => setCancelOpen(false)}
            title="Batalkan pengajuan retur?"
            description="Pengajuan retur akan ditutup dan penjual diberi tahu. Dana tidak bergerak — pembatalan ini hanya menutup pengajuan. Anda bisa mengajukan retur ulang selama masih dalam masa retur."
            cancelLabel="Kembali"
            confirmLabel="Ya, batalkan retur"
            loading={mutating}
            onConfirm={() => {
              setCancelOpen(false)
              void run("Gagal membatalkan retur", () => api.returns.cancelReturn(detail.id))
            }}
          />
          {/*
            FE-054 (audit frontend 2026-09-29): konfirmasi eskalasi memakai
            <Dialog> bermerek — jalur Alert.alert lama dihapus. Label
            konfirmasi eksplisit "Ya, eskalasi ke sengketa", bukan "Ya" ambigu.
          */}
          <Dialog
            visible={escalateOpen}
            onRequestClose={() => setEscalateOpen(false)}
            title="Eskalasi ke sengketa?"
            description="Kasus sengketa yang sudah ada akan dipakai ulang dan penjual akan diberi tahu."
            cancelLabel="Batal"
            confirmLabel="Ya, eskalasi ke sengketa"
            loading={mutating}
            onConfirm={() => {
              setEscalateOpen(false)
              void run("Gagal melakukan eskalasi", () => api.returns.escalateReturn(detail.id))
            }}
          />
        </View>
      ) : null}
    </DataScreen>
  )
}
