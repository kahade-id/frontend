/**
 * Screen — Sengketa Saya (GET /v1/disputes/my).
 * List DisputeCard; tap → detail sengketa (route /dispute/[id]).
 *
 * Audit: state async → `useApiQuery`, kerangka → <DataScreen>.
 *
 * M-52 (audit end-to-end 2026-09-24, issue #43): daftar DIPAGINASI
 * (`usePaginatedQuery` + <PaginatedList>, pola tab Transaksi) — dulu hanya
 * 50 sengketa pertama yang bisa dibuka tanpa jalan memuat lebih banyak.
 */
import { ShieldWarning } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { DisputeDetail } from "@/lib/api/disputes"
import { formatDateTime } from "@/lib/format"
import { orderFallbackLabel } from "@/lib/short-id"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { DisputeCard } from "@/components/ui/dispute-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"

const PAGE_LIMIT = 50

export default function DisputesScreen() {
  const query = usePaginatedQuery<DisputeDetail>(
    "disputes",
    (page, signal) => api.disputes.listMyDisputes({ page, limit: PAGE_LIMIT }, signal),
    // R2 (audit ronde-2, butir #26): kembali dari detail sengketa (yang status
    // nya bisa berubah, mis. penyelesaian bersama diterima) menyegarkan daftar.
    { refreshOnFocus: true },
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Sengketa" />
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={tokens.space[8]}
        header={<SectionHeader title="Sengketa saya" />}
        empty={
          <EmptyState
            icon={ShieldWarning}
            title="Tidak ada sengketa"
            description="Sengketa pesanan akan muncul di sini."
          />
        }
        renderItem={({ item }) => (
          <DisputeCard
            disputeId={item.id}
            // R2 (audit ronde-2, butir #38): fallback short-id — UUID mentah
            // 36 karakter tidak bisa dikenali manusia; judul order asli belum
            // dibawa endpoint daftar sengketa.
            orderTitle={orderFallbackLabel(item.orderId)}
            status={item.status}
            updatedAt={formatDateTime(item.updatedAt ?? item.createdAt)}
            href={ROUTES.disputeDetail(item.id)}
          />
        )}
      />
    </Screen>
  )
}
