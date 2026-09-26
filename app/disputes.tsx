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
import type { DisputeListItem } from "@/lib/api/disputes"
import { formatDateTime } from "@/lib/format"
import { orderFallbackLabel } from "@/lib/short-id"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { DisputeCard } from "@/components/ui/dispute-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const PAGE_LIMIT = 50

export default function DisputesScreen() {
  const insets = useSafeAreaInsets()
  // Identitas sendiri (cache bersama 5 dtk, C-02) — untuk peran di tiap kartu:
  // siapa pembuka, siapa lawan, dan apakah giliran saya yang ditunggu.
  const meQuery = useApiQuery("me", (signal) => api.users.getMeCached(signal))
  const meId = meQuery.data?.id
  const query = usePaginatedQuery<DisputeListItem>(
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
        bottomPadding={insets.bottom + tokens.space[8]}
        header={<SectionHeader title="Sengketa saya" />}
        empty={
          <EmptyState
            icon={ShieldWarning}
            title="Tidak ada sengketa"
            description="Sengketa pesanan akan muncul di sini."
          />
        }
        renderItem={({ item }) => {
          // Kartu diperkaya dari field daftar (bukan lagi terdegradasi):
          // peran saya dari buyerId/sellerId order + id sendiri.
          const order = item.order
          const myRole =
            meId && order
              ? order.buyerId === meId
                ? "buyer"
                : order.sellerId === meId
                  ? "seller"
                  : undefined
              : undefined
          const openedByMe =
            myRole && item.initiatedBy
              ? (item.initiatedBy === "BUYER") === (myRole === "buyer")
              : undefined
          // Giliran saya: status masih aktif dan klaim pihak saya belum masuk.
          const myClaimedAt = myRole === "buyer" ? item.buyerClaimedAt : myRole === "seller" ? item.sellerClaimedAt : undefined
          return (
            <DisputeCard
              disputeId={item.id}
              orderTitle={order?.title || orderFallbackLabel(item.orderId)}
              status={item.status}
              openedByMe={openedByMe}
              heldAmount={order?.orderValue}
              awaitingYou={myRole != null && myClaimedAt == null}
              updatedAt={formatDateTime(item.updatedAt ?? item.createdAt)}
              href={ROUTES.disputeDetail(item.id)}
            />
          )
        }}
      />
    </Screen>
  )
}
