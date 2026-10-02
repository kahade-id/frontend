/** Open a preparation screen immediately; shipment resolution belongs there. */
import { useCallback } from "react"
import { router } from "expo-router"

type ToastShow = (t: { title: string; description?: string; tone: "info" | "danger" }) => void

export function useOrderTracking(order: { id: string } | null, _toastShow: ToastShow) {
  const openTracking = useCallback(() => {
    if (!order) return
    router.navigate({ pathname: "/prepare-navigation", params: {
      kind: "tracking", id: order.id,
    } } as never)
  }, [order?.id])
  return { openTracking }
}
