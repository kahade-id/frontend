/**
 * Kahade — <OrderRoleBadge> (batch 139, D14).
 *
 * Badge peran yang SAMA ("Pembeli"/"Penjual") dipakai di tiga tempat halaman
 * detail order: header (<OrderStatusHero>), timeline riwayat
 * (<OrderHistoryTimeline>), dan area CTA (<OrderDetailActions>). Satu
 * komponen = label tidak bisa berubah-ubah antar-bagian.
 */
import { Badge } from "@/components/ui/badge"
import { translate } from "@/lib/i18n/translate"

/** Normalisasi peran dari berbagai casing ("BUYER"/"buyer") ke kanonik. */
export function normalizeOrderRole(role: string | undefined): "BUYER" | "SELLER" | undefined {
  if (role === "BUYER" || role === "buyer") return "BUYER"
  if (role === "SELLER" || role === "seller") return "SELLER"
  return undefined
}

export function OrderRoleBadge({
  role,
  className,
}: {
  role: string | undefined
  className?: string
}) {
  const normalized = normalizeOrderRole(role)
  if (!normalized) return null
  return (
    <Badge tone="info" className={className}>
      {normalized === "BUYER" ? translate("Pembeli") : translate("Penjual")}
    </Badge>
  )
}
