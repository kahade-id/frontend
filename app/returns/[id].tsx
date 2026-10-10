/**
 * Screen — Detail Retur (GAP-D G207–G217, G224).
 * GET /v1/returns/[id] · timeline purnajual · negosiasi dua pihak ·
 * aksi buyer/seller sesuai status.
 */
import { useState } from "react"
import { View } from "react-native"
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
import { translate } from "@/lib/i18n/translate"
import { validateTrackingInput } from "@/lib/wallet-batch139"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

function Timeline({ detail, dot }: { detail: ReturnDetail; dot: string }) {
  return (
    <View style={{ gap: tokens.space[2] }}>
      {(detail.timeline ?? []).map((t) => (
        <View key={t.id} style={{ flexDirection: "row", gap: tokens.space[2] }}>
          <View className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight={600}>
              {t.toStatus ? (RETURN_STATUS_LABEL[t.toStatus as keyof typeof RETURN_STATUS_LABEL] ?? t.toStatus) : t.event}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDateTime(t.createdAt)} · {RETURN_ACTOR_ROLE_LABEL[t.actorRole] ?? t.actorRole}
            </Text>
          </View>
        </View>
      ))}
      {(detail.timeline ?? []).length === 0 ? (
        <Text tone="secondary">Belum ada riwayat.</Text>
      ) : null}
    </View>
  )
}

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  // Mode Tanpa Wallet Internal: refund retur kembali ke metode pembayaran
  // asal (bukan ke dompet) — copy disesuaikan.
  const walletEnabled = useWalletEnabled()
  const c = tokens.colors[mode]
  const [note, setNote] = useState("")
  const [tracking, setTracking] = useState("")
  // E16 (audit alamat & kurir 2026-10-10): kurir retur ikut dikirim
  // (`SubmitReturnTrackingDto.courier`) — dulu selalu kosong sehingga penjual
  // hanya menerima nomor tanpa tahu kurirnya.
  const [returnCourier, setReturnCourier] = useState("")
  const returnTrackingValidation = validateTrackingInput(returnCourier, tracking, false)
  const returnTrackingValid =
    tracking.trim().length > 0 && !returnTrackingValidation.trackingError && !returnTrackingValidation.courierError
  const [mutating, setMutating] = useState(false)
  /** T4-010: dialog konfirmasi batal retur (menggantikan Alert.alert). */
  const [cancelOpen, setCancelOpen] = useState(false)
  // FE-050: konfirmasi penerimaan barang retur — dialog dulu, bukan
  // sekali-ketuk. Aksi ini menggerakkan dana/resolusi.
  const [confirmReceiveOpen, setConfirmReceiveOpen] = useState(false)
  /** FE-054: dialog konfirmasi eskalasi ke sengketa (menggantikan Alert.alert "Ya" ambigu). */
  const [escalateOpen, setEscalateOpen] = useState(false)
  const query = useApiQuery<ReturnDetail>(
    `return:${String(id)}`,
    (signal) => api.returns.getReturn(String(id), signal),
    !!id,
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
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
    <DataScreen
      title="Detail Retur"
      state={query}
      loadingMessage="Memuat detail retur…"
      // UX-SPA-007: ada input inline (nomor resi + pesan negosiasi) — tanpa
      // ini keyboard menutupi input & tombol kirim di iOS.
      keyboardAvoiding
    >
      {detail ? (
        <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="monoBody">{returnIdShort(detail)}</Text>
              <Badge>{RETURN_STATUS_LABEL[detail.status] ?? detail.status}</Badge>
            </View>
            <Text variant="body" style={{ marginTop: tokens.space[2] }}>{RETURN_REASON_LABEL[detail.reasonCode] ?? detail.reasonCode}</Text>
            {detail.reasonDetail ? <Text variant="body" tone="secondary">{detail.reasonDetail}</Text> : null}
            {detail.resolutionType ? (
              <Text variant="body" style={{ marginTop: tokens.space[1] }}>
                Penyelesaian: {detail.resolutionType ? (RETURN_RESOLUTION_LABEL[detail.resolutionType] ?? detail.resolutionType) : "—"}
                {detail.refundAmount != null ? (
                  <Text variant="monoBody"> · {formatIdrSen(detail.refundAmount)}</Text>
                ) : null}
              </Text>
            ) : null}
            {detail.resolutionType === "REFUND" && detail.refundAmount != null ? (
              <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
                {walletEnabled
                  ? "Dana dikembalikan ke dompet Anda."
                  : "Dana dikembalikan ke metode pembayaran Anda."}
              </Text>
            ) : null}
            {detail.sellerRespondBy && (detail.status === "REQUESTED" || detail.status === "SELLER_REVIEW") ? (
              <Text tone="warning" style={{ marginTop: tokens.space[1] }}>
                Penjual harus merespons sebelum {formatDateTimeWIB(detail.sellerRespondBy)}
              </Text>
            ) : null}
          </Card>

          {detail.returnInstructions ? (
            <Card>
              <SectionHeader title={translate("Instruksi pengiriman balik")} />
              <Text variant="body">{detail.returnInstructions}</Text>
              {detail.shipBy ? (
                <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
                  {translate("Kirim sebelum {x}", { x: formatDateTimeWIB(detail.shipBy) })}
                </Text>
              ) : null}
              {detail.returnTrackingNumber ? (
                <Text variant="body" style={{ marginTop: tokens.space[1] }}>
                  {translate("Resi retur:")} <Text variant="monoBody">{detail.returnTrackingNumber}</Text>
                  {detail.returnCourier ? ` (${detail.returnCourier})` : ""}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {detail.status === "APPROVED" ? (
            <Card>
              <SectionHeader title={translate("Kirim barang retur")} />
              <View style={{ gap: tokens.space[3] }}>
                <Field label={translate("Kurir (opsional)")} errorText={returnTrackingValidation.courierError}>
                  <Input
                    value={returnCourier}
                    onChangeText={setReturnCourier}
                    placeholder={translate("JNE, SiCepat, …")}
                    autoCapitalize="words"
                    maxLength={64}
                  />
                </Field>
                <Field
                  label={translate("Nomor resi pengiriman balik")}
                  required
                  errorText={tracking.trim() ? returnTrackingValidation.trackingError : undefined}
                >
                  <Input
                    value={tracking}
                    onChangeText={setTracking}
                    accessibilityLabel={translate("Nomor resi pengiriman balik")}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={64}
                  />
                </Field>
              </View>
              <View style={{ marginTop: tokens.space[2] }}>
                <Button
                  disabled={!returnTrackingValid || mutating}
                  loading={mutating}
                  onPress={() =>
                    run(
                      translate("Gagal mengirim resi"),
                      () =>
                        api.returns.submitReturnTracking(detail.id, {
                          trackingNumber: tracking.trim(),
                          ...(returnCourier.trim() ? { courier: returnCourier.trim() } : {}),
                        }),
                      { successTitle: translate("Resi terkirim") },
                    )
                  }
                >
                  {translate("Kirim Resi")}
                </Button>
              </View>
            </Card>
          ) : null}

          <Card>
            <SectionHeader title="Negosiasi" />
            <View style={{ gap: tokens.space[2] }}>
              {(detail.notes ?? []).map((n) => (
                <View key={n.id} style={{ backgroundColor: c.surface, borderRadius: tokens.radius.md, padding: tokens.space[2] }}>
                  <Text variant="caption" tone="secondary">{RETURN_ACTOR_ROLE_LABEL[n.authorRole] ?? n.authorRole} · {formatDateTime(n.createdAt)}</Text>
                  <Text variant="body">{n.message}</Text>
                </View>
              ))}
              {/* UI-T006 (audit UI/UX 2026-09-27): empty state eksplisit saat
                  belum ada pesan — sebelumnya kartu Negosiasi tampil kosong. */}
              {(detail.notes ?? []).length === 0 ? (
                <Text tone="secondary">Belum ada pesan.</Text>
              ) : null}
            </View>
            <Input
              label="Pesan negosiasi"
              value={note}
              onChangeText={setNote}
              placeholder="Tulis pesan untuk pihak lain…"
              accessibilityLabel="Pesan negosiasi"
              containerClassName="mt-2"
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
            <Timeline detail={detail} dot={c.primary} />
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
                onPress={() => setConfirmReceiveOpen(true)}
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
            FE-050 (audit UI/UX intuitif 2026-09-29): konfirmasi penerimaan
            barang retur memakai <Dialog> — sekali-ketuk terlalu mudah untuk
            aksi yang menggerakkan resolusi. Label konfirmasi eksplisit.
          */}
          <Dialog
            visible={confirmReceiveOpen}
            onRequestClose={() => setConfirmReceiveOpen(false)}
            title="Barang retur sudah diterima?"
            description="Pastikan barang retur sudah benar-benar Anda terima dan periksa kondisinya. Setelah dikonfirmasi, retur lanjut ke tahap penyelesaian."
            cancelLabel="Batal"
            confirmLabel="Ya, barang retur sudah diterima"
            loading={mutating}
            onConfirm={() => {
              setConfirmReceiveOpen(false)
              void run("Gagal mengonfirmasi penerimaan", () =>
                api.returns.confirmReturnReceived(detail.id),
                { successTitle: "Konfirmasi terima" },
              )
            }}
          />
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
            description="Pengajuan retur ditutup. Anda bisa mengajukan ulang selama masa retur."
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
