/**
 * Screen — Retur Saya (GAP-D G201–G225).
 * GET /v1/returns/my · tap → /returns/[id].
 *
 * UI-T002 (audit UI/UX 2026-09-27): daftar kini dipaginasi (sebelumnya hanya
 * halaman 1 / limit 50 — pengajuan ke-51+ tidak bisa dijangkau).
 */
import { useState } from "react"
import { Package } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { ReturnListItem } from "@/lib/api/returns"
import { RETURN_STATUS_LABEL, RETURN_REASON_LABEL, returnIdShort } from "@/lib/api/returns"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery, byTimestampDesc } from "@/lib/use-paginated-query"
import { useTheme } from "@/components/theme-provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Pressable, Text, View } from "react-native"

type Role = "buyer" | "seller"

const PAGE_LIMIT = 50

export default function ReturnsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const c = tokens.colors[mode]
  const [role, setRole] = useState<Role>("buyer")
  const query = usePaginatedQuery<ReturnListItem>(
    `returns:${role}`,
    (page, signal) => api.returns.listMyReturns({ page, limit: PAGE_LIMIT, role }, signal),
    {
      compare: byTimestampDesc<ReturnListItem>((r) => r.createdAt),
      keepPreviousOnKeyChange: true,
      refreshOnFocus: true,
    },
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Retur Barang" />
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={insets.bottom + tokens.space[8]}
        header={
          // UI-T013 (audit UI/UX 2026-09-27): toggle peran kini punya peran &
          // status aksesibilitas serta target sentuh ≥ 44pt.
          <View
            style={{
              flexDirection: "row",
              gap: tokens.space[2],
              paddingHorizontal: tokens.space[4],
              paddingBottom: tokens.space[3],
            }}
          >
            {(["buyer", "seller"] as Role[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                accessibilityRole="button"
                accessibilityLabel={r === "buyer" ? "Tampilkan retur sebagai pembeli" : "Tampilkan retur sebagai penjual"}
                accessibilityState={{ selected: role === r }}
                hitSlop={8}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: tokens.space[4],
                  borderRadius: tokens.radius.md,
                  backgroundColor: role === r ? c.primary : c.surface,
                }}
              >
                <Text style={{ color: role === r ? c.primaryForeground : c.textPrimary }}>
                  {r === "buyer" ? "Sebagai pembeli" : "Sebagai penjual"}
                </Text>
              </Pressable>
            ))}
          </View>
        }
        empty={
          <EmptyState
            icon={Package}
            title="Belum ada pengajuan retur"
            description="Pengajuan retur barang akan muncul di sini. Retur diajukan dari detail pesanan yang sudah selesai."
            action={
              <Button variant="secondary" onPress={() => router.push(ROUTES.transactions)}>
                Lihat transaksi saya
              </Button>
            }
          />
        }
        renderItem={({ item }: { item: ReturnListItem }) => (
          <Pressable
            onPress={() => router.push(ROUTES.returnDetail(item.id))}
            accessibilityRole="button"
            accessibilityLabel={`Retur ${returnIdShort(item)}, ${RETURN_STATUS_LABEL[item.status] ?? item.status}`}
          >
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "700" }}>{returnIdShort(item)}</Text>
                <Badge>{RETURN_STATUS_LABEL[item.status] ?? item.status}</Badge>
              </View>
              <Text style={{ color: c.textTertiary, marginTop: tokens.space[1] }}>
                {RETURN_REASON_LABEL[item.reasonCode] ?? item.reasonCode}
              </Text>
              <Text style={{ color: c.textTertiary, fontSize: 12 }}>
                Diajukan {formatDateTime(item.createdAt)}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  )
}
