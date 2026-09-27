/**
 * Hook — aksi "Lacak paket" dari detail order (GAP-D).
 *
 * Menyelesaikan shipmentId via GET /v1/courier/shipments/by-order/{orderId}
 * lalu membuka /tracking/[shipmentId]. Resi manual tanpa entitas shipment
 * terintegrasi → toast info (bukan error).
 *
 * Diekstrak dari app/order/[id].tsx (aturan S9: baris baru dibayar ekstraksi).
 */
import { useCallback, useRef } from "react"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { ROUTES } from "@/lib/routes"

type ToastShow = (t: { title: string; description?: string; tone: "info" | "danger" }) => void

export function useOrderTracking(order: { id: string } | null, toastShow: ToastShow) {
  const busyRef = useRef(false)

  const openTracking = useCallback(async () => {
    if (!order || busyRef.current) return
    busyRef.current = true
    try {
      const shipment = await api.courier.getShipmentByOrder(order.id)
      if (shipment) router.push(ROUTES.trackingDetail(shipment.id))
      else
        toastShow({
          title: "Belum ada data pelacakan",
          description: "Pengiriman ini memakai resi manual — belum ada timeline kurir terintegrasi.",
          tone: "info",
        })
    } catch (e) {
      toastShow({ title: "Gagal membuka pelacakan", description: userMessage(e), tone: "danger" })
    } finally {
      busyRef.current = false
    }
  }, [order, toastShow])

  return { openTracking }
}
