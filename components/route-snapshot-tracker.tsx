/**
 * FD-07 (audit etalase 2026-10-10): satu-satunya pelanggan rute untuk
 * `lib/current-route.ts` — dipasang sekali di root layout. Lihat catatan di
 * modul itu; komponen ini tidak merender apa pun.
 */
import { useEffect } from "react"
import { useGlobalSearchParams, usePathname } from "expo-router"

import { setRouteSnapshot } from "@/lib/current-route"

export function RouteSnapshotTracker() {
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  useEffect(() => {
    setRouteSnapshot({ pathname, params })
  }, [pathname, params])
  return null
}
