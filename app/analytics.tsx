/**
 * Screen — Laporan & Analitik.
 *
 * Endpoint:
 *   GET  /v1/users/me/stats            ringkasan profil (transaksi, rating, pengikut)
 *   GET  /v1/users/me/analytics?period volume & pendapatan per periode
 *   GET  /v1/orders                    sumber "unduh riwayat transaksi" (CSV dibangun di klien)
 *   GET  /v1/wallet/export/csv · /pdf  unduh riwayat dompet
 *   POST /v1/settings/privacy/export   ekspor data pribadi
 *
 * Layar ini adalah tujuan menu Pengaturan → "Laporan". Sebelumnya menu itu
 * membuka daftar laporan penyalahgunaan (`/reports`) dan analitik hanya bisa
 * dicapai dari pintasan Beranda, sehingga tidak ada satu tempat untuk
 * "melihat angka + mengunduh riwayat". Daftar laporan tetap tersedia sebagai
 * baris "Laporan saya" di bawah.
 *
 * Keputusan non-obvious:
 *   - `period` WAJIB di spec; pilihan periode dirender <SegmentedControl>
 *     dari `ANALYTICS_PERIODS` (lib/api/users) — bukan label statis.
 *     Kontrolnya dipasang di prop `above` <DataScreen> supaya TIDAK ikut
 *     terganti <LoadingScreen> saat periode berpindah (tanpa itu pengguna
 *     kehilangan pegangan tepat setelah mengetuk).
 *   - Pendapatan dijumlahkan dari `summary.revenue` (fallback
 *     `revenueByPeriod`) — sebelumnya selalu Rp0 karena ekspresi konstan.
 *   - CSV riwayat TRANSAKSI (order) dibangun di klien: backend tidak punya
 *     endpoint export order, hanya wallet. Nilainya ditulis MENTAH (angka
 *     tanpa pemisah ribuan, tanggal ISO) karena CSV adalah data untuk
 *     spreadsheet, bukan tampilan — `formatRupiah` di dalam sel akan merusak
 *     perhitungan di Excel.
 *   - Unduhan dibatasi `MAX_EXPORT_PAGES` halaman: tanpa batas, akun dengan
 *     puluhan ribu order membuat tombol "unduh" mengambil data tanpa akhir
 *     dan memori tab web membengkak.
 */
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  FileCsv,
  FileText,
  Receipt,
  ShoppingBag,
  Wallet as WalletIcon,
} from "phosphor-react-native"

import { api, type Order, userMessage } from "@/lib/api"
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/api/users"
import { csvBlob, saveBlobFile, toCsv } from "@/lib/export-file"
import { formatDecimal, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { useWalletExport } from "@/lib/use-wallet-export"

import { AnalyticsSummary } from "@/components/ui/analytics-summary"
import { DataScreen } from "@/components/ui/data-screen"
import { ListItem } from "@/components/ui/list-item"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useToast } from "@/components/ui/toast"

const DEFAULT_PERIOD: AnalyticsPeriod = "30d"

/** 20 halaman × 50 order = 1.000 transaksi per unduhan. */
const EXPORT_PAGE_SIZE = 50
const MAX_EXPORT_PAGES = 20

const ORDER_CSV_HEADERS = [
  "ID",
  "Judul",
  "Jenis",
  "Status",
  "Nilai order",
  "Biaya platform",
  "Peran saya",
  "Pembeli",
  "Penjual",
  "Dibuat",
  "Diperbarui",
] as const

function orderCsvRow(order: Order): Array<string | number | null> {
  return [
    order.id,
    order.title,
    order.orderType,
    order.status,
    order.orderValue,
    order.fee?.platformFee ?? "",
    order.myRole ?? "",
    order.buyer?.username ?? "",
    order.seller?.username ?? "",
    order.createdAt,
    order.updatedAt ?? "",
  ]
}

export default function AnalyticsScreen() {
  const toast = useToast()

  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_PERIOD)
  const query = useApiQuery(`analytics:${period}`, (signal) =>
    Promise.all([api.users.getMyStats(signal), api.users.getMyAnalytics(period, signal)]),
  )
  const stats = query.data?.[0]
  const analytics = query.data?.[1]

  const { exporting, exportWallet } = useWalletExport()
  const [exportingOrders, setExportingOrders] = useState(false)
  const [exportingPrivacy, setExportingPrivacy] = useState(false)

  const revenue = useMemo(() => {
    if (analytics?.summary?.revenue != null) return analytics.summary.revenue
    if (analytics?.revenueByPeriod?.length)
      return analytics.revenueByPeriod.reduce((sum, p) => sum + p.value, 0)
    return null
  }, [analytics])

  const periodLabel = ANALYTICS_PERIODS.find((p) => p.value === period)?.label ?? ""

  /** Unduh riwayat transaksi (order) sebagai CSV — dibangun di klien. */
  const handleExportOrders = useCallback(async () => {
    if (exportingOrders) return
    setExportingOrders(true)
    try {
      const orders: Order[] = []
      let page = 1
      let totalPages = 1
      do {
        const result = await api.orders.listOrders({
          page,
          limit: EXPORT_PAGE_SIZE,
          role: "ALL",
        })
        orders.push(...result.data)
        totalPages = result.meta.totalPages
        page += 1
      } while (page <= totalPages && page <= MAX_EXPORT_PAGES)

      if (orders.length === 0) {
        toast.show({
          title: "Tidak ada transaksi untuk diunduh",
          description: "Riwayat transaksi Anda masih kosong.",
          tone: "info",
        })
        return
      }

      const saved = await saveBlobFile(
        csvBlob(toCsv(ORDER_CSV_HEADERS, orders.map(orderCsvRow))),
        "kahade-riwayat-transaksi.csv",
        "text/csv",
      )
      toast.show({
        title: saved.kind === "downloaded" ? "Riwayat transaksi diunduh" : "Riwayat transaksi siap dibagikan",
        description: `${orders.length} transaksi · ${saved.filename}`,
        tone: "success",
        duration: 4000,
      })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal mengunduh riwayat transaksi",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setExportingOrders(false)
    }
  }, [exportingOrders, toast.show])

  /** POST /v1/settings/privacy/export — backend bisa membalas url atau pesan. */
  const handleExportPrivacy = useCallback(async () => {
    if (exportingPrivacy) return
    setExportingPrivacy(true)
    try {
      const result = await api.settings.exportPrivacy()
      toast.show({
        title: "Permintaan ekspor data dikirim",
        description: result?.message ?? "Tautan unduh akan dikirim ke email terdaftar Anda.",
        tone: "success",
        duration: 5000,
      })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal meminta ekspor data",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setExportingPrivacy(false)
    }
  }, [exportingPrivacy, toast.show])

  return (
    <DataScreen
      title="Laporan & Analitik"
      state={query}
      loadingMessage="Memuat analitik"
      errorTitle="Gagal memuat analitik"
      above={
        <View className="px-6 pt-3">
          <SegmentedControl
            accessibilityLabel="Pilih periode analitik"
            items={ANALYTICS_PERIODS}
            value={period}
            onChange={(v) => setPeriod(v as AnalyticsPeriod)}
          />
        </View>
      }
    >
      <AnalyticsSummary
        loading={false}
        periodLabel={`${periodLabel} terakhir`}
        stats={[
          {
            id: "orders",
            label: "Transaksi",
            value: stats?.transactions ?? "—",
            hint: "Total transaksi selesai",
          },
          {
            id: "revenue",
            label: "Pendapatan",
            value: revenue != null ? formatRupiah(revenue) : "—",
            hint:
              analytics?.avgOrderValue != null
                ? `Rata-rata ${formatRupiah(analytics.avgOrderValue)}`
                : "Nilai order masuk",
          },
          {
            id: "rating",
            label: "Rating",
            value: stats?.rating != null ? formatDecimal(stats.rating, 1) : "—",
            hint: stats?.reviews != null ? `${stats.reviews} ulasan` : undefined,
          },
          {
            id: "followers",
            label: "Pengikut",
            value: stats?.followers ?? "—",
            hint: stats?.following != null ? `${stats.following} mengikuti` : undefined,
          },
        ]}
        chart={analytics?.volumeByPeriod?.map((p) => ({ label: p.label, value: p.value }))}
        chartTitle="Volume transaksi"
        formatChartValue={(v) => formatRupiah(v, { compact: true })}
        ratios={
          analytics?.completionRate != null
            ? [
                {
                  id: "completion",
                  label: "Tingkat penyelesaian",
                  value: `${formatDecimal(analytics.completionRate <= 1 ? analytics.completionRate * 100 : analytics.completionRate, 0)}%`,
                },
              ]
            : undefined
        }
        ratiosTitle="Kualitas"
      />

      {/* ── Unduh riwayat ─────────────────────────────────── */}
      <SectionHeader title="Unduh Riwayat" level="h3" />
      <View className="w-full overflow-hidden bg-surface">
        <ListItem
          title="Riwayat transaksi (CSV)"
          titleVariant="bodyLarge"
          leading={FileCsv}
          chevron
          disabled={exportingOrders}
          onPress={() => void handleExportOrders()}
          trailing={exportingOrders ? "Menyiapkan…" : undefined}
        />
        <ListItem
          title="Riwayat dompet (CSV)"
          titleVariant="bodyLarge"
          leading={FileCsv}
          chevron
          disabled={exporting !== null}
          onPress={() => void exportWallet("csv")}
          trailing={exporting === "csv" ? "Menyiapkan…" : undefined}
        />
        <ListItem
          title="Riwayat dompet (cetak)"
          titleVariant="bodyLarge"
          leading={FileText}
          chevron
          disabled={exporting !== null}
          onPress={() => void exportWallet("pdf")}
          trailing={exporting === "pdf" ? "Menyiapkan…" : undefined}
        />
        <ListItem
          title="Ekspor data pribadi"
          titleVariant="bodyLarge"
          leading={Receipt}
          chevron
          disabled={exportingPrivacy}
          onPress={() => void handleExportPrivacy()}
          trailing={exportingPrivacy ? "Mengirim…" : undefined}
        />
      </View>

      {/* ── Riwayat & laporan ─────────────────────────────── */}
      <SectionHeader title="Riwayat" level="h3" />
      <View className="w-full overflow-hidden bg-surface">
        <ListItem
          title="Riwayat dompet"
          titleVariant="bodyLarge"
          leading={WalletIcon}
          chevron
          href={ROUTES.walletHistory}
        />
        <ListItem
          title="Riwayat top-up"
          titleVariant="bodyLarge"
          leading={ArrowCircleDown}
          chevron
          href={ROUTES.topupHistory}
        />
        <ListItem
          title="Riwayat penarikan"
          titleVariant="bodyLarge"
          leading={ArrowCircleUp}
          chevron
          href={ROUTES.withdrawHistory}
        />
        <ListItem
          title="Semua transaksi"
          titleVariant="bodyLarge"
          leading={ShoppingBag}
          chevron
          href={ROUTES.transactions}
        />
        <ListItem
          title="Laporan saya"
          titleVariant="bodyLarge"
          leading={FileText}
          chevron
          href={ROUTES.reports()}
        />
      </View>
    </DataScreen>
  )
}
