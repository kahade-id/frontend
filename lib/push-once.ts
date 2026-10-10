/**
 * Kahade — navigasi push sekali-jalan (DT-06, audit etalase 2026-10-10).
 *
 * `router.push` SELALU menambah entri stack — tap ganda cepat pada "Beli via
 * Kahade"/"Chat penjual" menumpuk dua layar yang sama (back sekali masih di
 * wizard). Helper ini membuang push ke tujuan yang SAMA dalam jendela
 * singkat; tujuan berbeda tetap lewat.
 *
 * Modul ini sengaja tanpa dependensi UI (bukan di lib/navigation.ts yang
 * menarik ToastProvider) supaya bisa diuji di lingkungan node.
 */
import { router } from "expo-router"
import type { Href } from "expo-router"

export const PUSH_ONCE_WINDOW_MS = 800
let lastPush: { key: string; at: number } | null = null

/** @returns true bila navigasi dijalankan, false bila dianggap tap ganda. */
export function pushOnce(
  href: Href,
  nav: { push: (href: Href) => void } = router,
  now: number = Date.now(),
): boolean {
  const key = typeof href === "string" ? href : JSON.stringify(href)
  if (lastPush && lastPush.key === key && now - lastPush.at < PUSH_ONCE_WINDOW_MS) return false
  lastPush = { key, at: now }
  nav.push(href)
  return true
}

export function resetPushOnceForTests(): void {
  lastPush = null
}
