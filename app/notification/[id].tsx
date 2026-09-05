/**
 * Kahade — placeholder deep link `/notification/[id]`.
 *
 * TODO: ganti dengan layar detail notifikasi bila backend menyediakan
 * `GET /v1/notifications/:id`. Saat ini spec hanya punya list
 * (`GET /v1/notifications`), sehingga tidak ada yang bisa dirender per id.
 *
 * Rute ini tetap dibuat sekarang supaya URL-nya sudah sah sejak awal: link
 * `kahade.id/notification/<id>` yang beredar di email atau push lama tidak
 * berakhir di 404, melainkan di daftar notifikasi.
 *
 * Catatan arah: deep link push Kahade sebaiknya menunjuk ENTITAS-nya
 * (`/order/123`, `/dispute/9`) lewat `routeForPushData`, bukan
 * `/notification/<id>` — pengguna ingin melihat ordernya, bukan barisan
 * notifikasinya. Rute ini adalah jaring pengaman, bukan jalur utama.
 */
import { Redirect } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function NotificationDeepLinkPlaceholder() {
  return <Redirect href={ROUTES.notifications} />
}
