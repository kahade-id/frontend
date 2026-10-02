/** Kompatibilitas tautan lama: pengaturan perangkat + server kini satu layar. */
import { Redirect } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function NotificationSettingsScreen() {
  return <Redirect href={ROUTES.notificationPreferences} />
}
