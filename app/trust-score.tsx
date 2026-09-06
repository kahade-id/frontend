/**
 * Screen — Skor Kepercayaan (GET /v1/users/me/trust-score).
 *
 * Audit: state async dipindah ke `useApiQuery` (abort + pesan galat backend)
 * dan kerangka layar ke <DataScreen>. Import <EmptyState> yang tidak pernah
 * dirender juga dihapus.
 */
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { Text } from "@/components/ui/text"
import { TrustScoreCard } from "@/components/ui/trust-score-card"

export default function TrustScoreScreen() {
  const query = useApiQuery("trust-score", () => api.users.getMyTrustScore())
  const data = query.data

  return (
    <DataScreen title="Skor Kepercayaan" state={query} loadingMessage="Memuat skor…">
      {data ? (
        <>
          <TrustScoreCard
            score={data.score}
            tier={data.tier}
            factors={data.factors}
            updatedAt={data.updatedAt ? formatDateTime(data.updatedAt) : undefined}
          />
          <Text numberOfLines={1} variant="body" tone="secondary">
            Skor kepercayaan dihitung dari verifikasi identitas, riwayat transaksi, dan ulasan
            Anda. Semakin tinggi skor, semakin dipercaya lawan transaksi.
          </Text>
        </>
      ) : null}
    </DataScreen>
  )
}
