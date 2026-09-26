/**
 * Rute legacy "/subscriptions" — dialihkan ke Kahade+.
 *
 * Layar lama (Langganan Premium, 727 baris) dipensiunkan pada 2026-09-26:
 * memakai endpoint lama dan sudah tidak ada yang menautkannya. Satu-satunya
 * alur subscription yang didukung adalah Kahade+ di /kahade-plus/* dengan
 * source of truth tunggal di backend
 * (SubscriptionsService.isActive/getSubscription). Rute ini dipertahankan
 * sebagai redirect agar deep link lama tidak mati. Backup layar lama ada di
 * /tmp/subscriptions_legacy_backup.tsx (sementara, bukan bagian repo).
 */
import { Redirect } from "expo-router"
import { ROUTES } from "@/lib/routes"

export default function LegacySubscriptionsRedirect() {
  return <Redirect href={ROUTES.kahadePlusPlans} />
}
