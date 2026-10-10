/** Open a preparation screen immediately; shipment resolution belongs there. */
import { useCallback } from "react"
import { router } from "expo-router"

/**
 * E13 (audit alamat & kurir 2026-10-10): parameter toast yang tidak pernah
 * dipakai dihapus — resolusi shipment + pesan kesalahan ada di
 * `app/prepare-navigation.tsx`.
 */
export function useOrderTracking(order: { id: string } | null) {
  const openTracking = useCallback(() => {
    if (!order) return
    router.navigate({ pathname: "/prepare-navigation", params: {
      kind: "tracking", id: order.id,
    } } as never)
  }, [order?.id])
  return { openTracking }
}
