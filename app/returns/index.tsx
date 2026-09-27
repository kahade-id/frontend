/**
 * Screen — Retur Saya (GAP-D G201–G225).
 * GET /v1/returns/my · tap → /returns/[id].
 */
import { useState } from "react"
import { Package } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { ReturnListItem } from "@/lib/api/returns"
import { RETURN_STATUS_LABEL, RETURN_REASON_LABEL, returnIdShort } from "@/lib/api/returns"
import type { Page } from "@/lib/api/response"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useTheme } from "@/components/theme-provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Pressable, Text, View } from "react-native"

type Role = "buyer" | "seller"

export default function ReturnsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const c = tokens.colors[mode]
  const [role, setRole] = useState<Role>("buyer")
  const query = useApiQuery<Page<ReturnListItem>>(
    `returns:${role}`,
    (signal) => api.returns.listMyReturns({ page: 1, limit: 50, role }, signal),
    true,
    { refreshOnFocus: true },
  )
  const items = query.data?.data ?? []

  return (
    <DataScreen
      title="Retur Barang"
      state={query}
      loadingMessage="Memuat pengajuan retur…"
      above={
        <View style={{ flexDirection: "row", gap: tokens.space[2], padding: tokens.space[4] }}>
          {(["buyer", "seller"] as Role[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={{
                paddingHorizontal: tokens.space[4],
                paddingVertical: tokens.space[2],
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
      empty={items.length === 0 && {
        icon: Package,
        title: "Belum ada pengajuan retur",
        description: "Pengajuan retur barang akan muncul di sini.",
      }}
    >
      <View style={{ paddingBottom: insets.bottom + tokens.space[8], gap: tokens.space[3] }}>
        {items.map((item: ReturnListItem) => (
          <Pressable key={item.id} onPress={() => router.push(ROUTES.returnDetail(item.id))}>
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
        ))}
      </View>
    </DataScreen>
  )
}
