/**
 * Screen — Laporan Saya (GET /v1/settings/reports).
 * Bila dibuka dengan `targetId`/`targetName` (dari Profil Publik), tampilkan
 * <ReportForm> di atas untuk membuat laporan (POST /v1/settings/report).
 */

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Flag } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ReportsSettings } from "@/lib/api/settings"
import { formatDateTime } from "@/lib/format"
import {
  REPORT_CATEGORY_LABELS,
  REPORT_REASON_TO_CATEGORY,
  USER_REPORT_REASONS,
} from "@/lib/labels/report"
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@/lib/labels/status"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ReportForm, type ReportFormValue } from "@/components/ui/report-form"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { hasOwn, mapValue } from "@/lib/has-own"
import { translate } from "@/lib/i18n/translate"

/**
 * Peta alasan UI → enum API POST /v1/settings/report.
 *
 * Peta alasan→kategori hidup di `lib/labels/report` (G-13) dengan tipe kunci
 * `UserReportReason` dan tipe nilai `ReportUserSettingsDto["category"]` —
 * alasan baru tanpa padanan gagal `tsc`, bukan 400 di produksi.
 * `MONEY_LAUNDERING` sengaja tidak ditawarkan di UI; `mapValue` memakai
 * `OTHER` sebagai jaring pengaman untuk alasan di luar peta.
 */
// G-13: peta alasan→kategori kini satu sumber di lib/labels/report.
const REASON_TO_CATEGORY = REPORT_REASON_TO_CATEGORY

/*
 * I-08 (audit 2026-09-22): peta status lokal dihapus — label & tone laporan
 * hidup di `lib/labels/status.ts` bersama status lain, sehingga teks yang
 * sama tidak lagi punya dua definisi (dan ikut ter-translate lewat
 * `translate()` di titik render).
 */
const STATUS_TONE: Record<string, BadgeTone> = REPORT_STATUS_TONE
const STATUS_LABELS: Record<string, string> = REPORT_STATUS_LABELS

const CATEGORY_LABELS = REPORT_CATEGORY_LABELS

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
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {targetId ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title={translate("Laporkan {x}", {
                x: targetName ? `@${targetName}` : translate("pengguna"),
              })}
            />
            <ReportForm
              targetName={targetName ? `@${targetName}` : undefined}
              // I-06: alasan dari SATU sumber (lib/labels/report) — komponen
              // tidak lagi punya daftar cadangan yang berbeda tipe.
              reasons={USER_REPORT_REASONS}
              value={value}
              onChange={setValue}
              onSubmit={(v) => void handleSubmit(v)}
              submitting={submitting}
            />
          </View>
        ) : null}

        <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Laporan saya" />
          <Crossfade loading={reports.loading} skeleton={<ListLoading />}>
            {reports.error ? (
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
                const status = r.status as string
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
          </Crossfade>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
