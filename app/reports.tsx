import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Laporan Saya (GET /v1/settings/reports).
 * Bila dibuka dengan `targetId`/`targetName` (dari Profil Publik), tampilkan
 * <ReportForm> di atas untuk membuat laporan (POST /v1/settings/report).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Flag } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ReportsSettings } from "@/lib/api/settings"
import type { ReportUserSettingsDto } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import {
  ReportForm,
  type ReportFormValue,
  type ReportReason,
} from "@/components/ui/report-form"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { hasOwn, mapValue } from "@/lib/has-own"

/**
 * Peta alasan UI → enum API POST /v1/settings/report.
 *
 * Tipe kunci = `ReportReason` (bukan `string`) sehingga setiap alasan yang
 * ditampilkan `REPORT_REASONS` wajib punya padanan — alasan baru tanpa peta
 * gagal `tsc`. Tipe nilai = `ReportUserSettingsDto["category"]` sehingga
 * salah ketik nama kategori juga gagal `tsc`. Sebelumnya peta ini
 * `Record<string, string>` dan pemanggilnya memakai cast `as ...["category"]`,
 * jadi keduanya lolos kompilasi dan baru meledak sebagai 400 di backend.
 *
 * `MONEY_LAUNDERING` sengaja tidak dipetakan: enum backend boleh lebih luas
 * daripada pilihan yang kita tampilkan; `mapValue` memakai `OTHER` sebagai
 * jaring pengaman untuk alasan di luar peta.
 */
const REASON_TO_CATEGORY: Record<ReportReason, ReportUserSettingsDto["category"]> = {
  SCAM: "FRAUD",
  HARASSMENT: "TNC_VIOLATION",
  FAKE_ACCOUNT: "FAKE_IDENTITY",
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE_CONTENT",
  SPAM: "SPAM",
  OTHER: "OTHER",
}

export type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED" | (string & {})
const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  PENDING: "warning",
  REVIEWING: "warning",
  RESOLVED: "success",
  REJECTED: "neutral",
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "Menunggu tinjauan",
  REVIEWING: "Ditinjau",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
}

const CATEGORY_LABELS: Record<string, string> = {
  FRAUD: "Penipuan",
  FAKE_IDENTITY: "Identitas palsu",
  INAPPROPRIATE_CONTENT: "Konten tidak pantas",
  TNC_VIOLATION: "Pelanggaran ketentuan",
  MONEY_LAUNDERING: "Pencucian uang",
  SPAM: "Spam",
  OTHER: "Lainnya",
}

export default function ReportsScreen() {
  const { targetId, targetName } = useLocalSearchParams<{
    targetId?: string
    targetName?: string
  }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<ReportFormValue>({ reason: "", detail: "" })
  const [submitting, setSubmitting] = useState(false)

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: hook ini membatalkan
   * request lama saat layar di-unmount, memisahkan `loading` dari
   * `refreshing`, dan mengubah error lewat `userMessage(err)`.
   *
   * Yang diperbaiki untuk pengguna: `handleRefresh` sebelumnya memanggil
   * fetcher yang sama dengan muat-awal, jadi `setLoading(true)` mengganti
   * seluruh daftar dengan <ListLoading> — layar berkedip kosong setiap kali
   * ditarik untuk menyegarkan. Sekarang `refresh` hanya menampilkan indikator
   * pull-to-refresh dan isi layar tetap terlihat.
   */
  const reports = useApiQuery<ReportsSettings[]>(
    "reports",
    (signal) => api.settings.getReports(signal),
  )
  const items = reports.data ?? []

  const handleSubmit = useCallback(
    async (v: ReportFormValue) => {
      if (!targetId) return
      setSubmitting(true)
      try {
        await api.settings.reportUser(
          {
            targetId,
            category: mapValue(REASON_TO_CATEGORY, v.reason, "OTHER"),
            description: v.detail.trim(),
          },
          // `targetName` adalah username. Bila `targetId` yang dikirim profil
          // publik ternyata bukan id yang dikenali backend (spec tidak
          // mendokumentasikan bentuk respons `GET /v1/users/{username}`),
          // adapter mencoba ulang dengan username — inilah sebabnya Laporkan
          // dulu gagal dengan "user tidak tersedia" di halaman user itu sendiri.
          targetName,
        )
        toast.show({ title: "Laporan terkirim", tone: "success", duration: 3000 })
        setValue({ reason: "", detail: "" })
        await reports.reload()
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengirim laporan",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [targetId, toast.show, reports],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Laporan" />
      <PullToRefresh
        onRefresh={reports.refresh}
        refreshing={reports.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {targetId ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`Laporkan ${targetName ? `@${targetName}` : "pengguna"}`} />
            <ReportForm
              targetName={targetName ? `@${targetName}` : undefined}
              value={value}
              onChange={setValue}
              onSubmit={(v) => void handleSubmit(v)}
              submitting={submitting}
            />
          </View>
        ) : null}

        <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Laporan saya" />
          {reports.loading ? (
            <ListLoading />
          ) : reports.error ? (
            <ErrorState
              title="Gagal memuat"
              description={reports.error}
              onRetry={() => void reports.reload()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="Belum ada laporan"
              description="Laporan yang Anda kirim akan muncul di sini."
            />
          ) : (
            <ListGroup>
              {items.map((r, i) => {
                const status = r.status as ReportStatus
                // Own keys only: `in` would also match Object.prototype
                // keys ("toString"), whose value is a function and would be
                // rendered as the badge label.
                const known = hasOwn(STATUS_TONE, status)
                return (
                  <ListItem
                    key={r.id}
                    title={mapValue(CATEGORY_LABELS, r.category, r.category)}
                    subtitle={formatDateTime(r.createdAt)}
                    leading={Flag}
                    trailing={
                      <Badge tone={known ? STATUS_TONE[status] : "neutral"}>
                        {known ? STATUS_LABELS[status] : r.status}
                      </Badge>
                    }
                    divider={i < items.length - 1}
                  />
                )
              })}
            </ListGroup>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
