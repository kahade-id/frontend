/**
 * Screen — Sengketa Saya (GET /v1/disputes/my).
 * List DisputeCard; tap → detail sengketa (route /dispute/[id]).
 *
 * Audit: state async → `useApiQuery`, kerangka → <DataScreen>.
 */
import { ShieldWarning } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { DisputeCard } from "@/components/ui/dispute-card"
import { SectionHeader } from "@/components/ui/section"

const PAGE_LIMIT = 50

export default function DisputesScreen() {
  const query = useApiQuery("disputes", () =>
    api.disputes.listMyDisputes({ page: 1, limit: PAGE_LIMIT }),
  )
  const items = query.data ?? []

  return (
    <DataScreen
      title="Sengketa"
      state={query}
      loadingMessage="Memuat sengketa…"
      empty={
        items.length === 0 && {
          icon: ShieldWarning,
          title: "Tidak ada sengketa",
          description: "Sengketa pesanan akan muncul di sini.",
        }
      }
    >
      <SectionHeader title="Sengketa saya" />
      {items.map((d) => (
        <DisputeCard
          key={d.id}
          disputeId={d.id}
          orderTitle={`Order ${d.orderId}`}
          status={d.status}
          updatedAt={formatDateTime(d.updatedAt ?? d.createdAt)}
          onPress={() => router.push(ROUTES.disputeDetail(d.id))}
        />
      ))}
    </DataScreen>
  )
}