/**
 * Kahade — <OrderHelpActions>: pintu masuk sengketa & retur dari layar
 * jastip/patungan/booking jasa (Poin 2, 2026-10-04, unifikasi transaksi escrow).
 *
 * Ditampilkan HANYA bila ada orderId terkait — pemanggil me-render
 * kondisional (`orderId ? <OrderHelpActions orderId={orderId} /> : null`).
 * Hari ini grep ROUTES.disputeDetail/newReturn di layar-layar itu = nol;
 * kedua rute diverifikasi ada (lib/routes.ts: disputeDetail, newReturn).
 *
 * - "Sengketa": bila user punya sengketa untuk order ini → detail sengketa
 *   (ROUTES.disputeDetail); bila belum ada → daftar "Sengketa Saya"
 *   (ROUTES.disputes). Resolusi disputeId via satu query daftar sengketa
 *   saya (kunci kanonis bersama — semua instance berbagi satu fetch).
 * - "Ajukan retur": form retur dengan order terisi otomatis
 *   (ROUTES.newReturn(orderId)).
 *
 * Keputusan non-obvious: lookup sengketa dilakukan LAZY di komponen ini
 * (bukan di tiap layar) supaya jastip/patungan/booking tidak menambah query
 * sendiri-sendiri; bila daftar gagal dimuat, tombol tetap mengarah ke daftar
 * "Sengketa Saya" (fail-open ke pintu masuk yang selalu ada).
 */
import { useCallback, useMemo } from "react"
import { View } from "react-native"
import { ArrowUDownLeft, ShieldWarning } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n/translate"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"

/** Kunci cache kanonis untuk resolusi sengketa-per-order (dibagi semua instance). */
const DISPUTE_LOOKUP_QUERY_KEY = "my-disputes-order-lookup"

/** Id sengketa milik user untuk satu order — null bila belum ada / gagal dimuat. */
function useDisputeIdForOrder(orderId: string): string | null {
  const query = useApiQuery(
    DISPUTE_LOOKUP_QUERY_KEY,
    useCallback(
      (signal: AbortSignal) => api.disputes.listMyDisputes({ page: 1, limit: 50 }, signal),
      [],
    ),
  )
  return useMemo(() => {
    const items = query.data?.data ?? []
    const hit = items.find((d) => d.orderId === orderId || d.order?.orderId === orderId)
    return hit?.id ?? null
  }, [query.data, orderId])
}

export function OrderHelpActions({ orderId }: { orderId: string }) {
  const disputeId = useDisputeIdForOrder(orderId)

  const openDispute = useCallback(() => {
    router.push(disputeId ? ROUTES.disputeDetail(disputeId) : ROUTES.disputes)
  }, [disputeId])

  const openReturn = useCallback(() => {
    router.push(ROUTES.newReturn(orderId))
  }, [orderId])

  return (
    <View className="flex-row gap-2">
      <Button
        variant="secondary"
        size="sm"
        fullWidth={false}
        leftIcon={ShieldWarning}
        onPress={openDispute}
      >
        {disputeId ? translate("Lihat sengketa") : translate("Sengketa saya")}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        fullWidth={false}
        leftIcon={ArrowUDownLeft}
        onPress={openReturn}
      >
        {translate("Ajukan retur")}
      </Button>
    </View>
  )
}
