/**
 * Kahade — preferensi notifikasi granular LOKAL per jenis (client-side only).
 *
 * PENTING — BACA SEBELUM MENGUBAH:
 * Ini preferensi PERANGKAT, bukan server. Toggle di sini HANYA menahan
 * banner + entri tray sistem untuk notifikasi yang tiba saat aplikasi
 * FOREGROUND (via `setNotificationHandler` di lib/push-notifications.ts).
 * Push yang tiba saat aplikasi background/tertutup tetap dikirim dan
 * ditampilkan menurut preferensi SERVER (layar "Preferensi Notifikasi" →
 * GET/PUT /v1/notifications/preferences). Jangan pernah mengklaim di UI
 * bahwa toggle ini menghentikan push dari server.
 *
 * Keputusan non-obvious:
 *   - Fail-open: tipe push yang TIDAK terpetakan (`null`) SELALU menampilkan
 *     banner. Di produk keuangan, menelan notifikasi tak dikenal diam-diam
 *     lebih berbahaya daripada menampilkannya.
 *   - Keamanan (SECURITY_*, KYC_*, SYSTEM_*) sengaja TIDAK masuk daftar
 *     toggle — selaras dengan layar preferensi server yang mengunci
 *     `securityInApp`/`securityPush`.
 *   - Pola store modul-level + `useSyncExternalStore` mengikuti
 *     lib/ui-prefs.ts: satu blob JSON di SecureStore, satu baca saat boot.
 */
import { useSyncExternalStore } from "react"

import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

/** Jenis notifikasi yang bisa di-toggle pengguna (urutan = urutan tampil). */
export const LOCAL_NOTIFICATION_KINDS = ["chat", "transaction", "showcase", "promo"] as const

export type LocalNotificationKind = (typeof LOCAL_NOTIFICATION_KINDS)[number]

export type LocalNotificationPrefs = Record<LocalNotificationKind, boolean>

/** Bawaan: semua jenis tampil (perilaku lama tidak berubah). */
export const DEFAULT_LOCAL_NOTIFICATION_PREFS: LocalNotificationPrefs = {
  chat: true,
  transaction: true,
  showcase: true,
  promo: true,
}

/** Sanitasi blob storage → prefs valid; nilai rusak/asing jatuh ke bawaan. */
export function parseLocalNotificationPrefs(raw: unknown): LocalNotificationPrefs {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_LOCAL_NOTIFICATION_PREFS }
  const rec = raw as Record<string, unknown>
  const out = { ...DEFAULT_LOCAL_NOTIFICATION_PREFS }
  for (const kind of LOCAL_NOTIFICATION_KINDS) {
    const value = rec[kind]
    if (typeof value === "boolean") out[kind] = value
  }
  return out
}

let prefs: LocalNotificationPrefs = { ...DEFAULT_LOCAL_NOTIFICATION_PREFS }
const listeners = new Set<() => void>()
let loadPromise: Promise<LocalNotificationPrefs> | null = null

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Muat dari storage sekali per proses; aman dipanggil berulang/paralel. */
export function ensureLocalNotificationPrefs(): Promise<LocalNotificationPrefs> {
  if (!loadPromise) {
    loadPromise = getSecureItem(SecureKeys.notificationLocalPrefs)
      .catch((err) => {
        logWarn("local-notif-prefs:load", err)
        return null
      })
      .then((raw) => {
        prefs = parseLocalNotificationPrefs(raw ? safeJsonParse(raw) : null)
        emit()
        return prefs
      })
      .catch((err) => {
        logWarn("local-notif-prefs:load-failed", err)
        loadPromise = null // izinkan coba lagi pada pemanggilan berikutnya
        return prefs
      })
  }
  return loadPromise
}

export function getLocalNotificationPrefsSnapshot(): LocalNotificationPrefs {
  return prefs
}

/** Hook untuk layar pengaturan (ikut re-render saat bahasa/prefs berubah). */
export function useLocalNotificationPrefs(): LocalNotificationPrefs {
  return useSyncExternalStore(subscribe, getLocalNotificationPrefsSnapshot, getLocalNotificationPrefsSnapshot)
}

/**
 * Ubah satu toggle; persist async (kegagalan hanya dicatat — preferensi UI
 * bukan data kritis, state memori tetap benar untuk sesi ini).
 */
export function setLocalNotificationPref(kind: LocalNotificationKind, value: boolean): void {
  prefs = { ...prefs, [kind]: value }
  emit()
  void setSecureItem(SecureKeys.notificationLocalPrefs, JSON.stringify(prefs)).catch((err) =>
    logWarn("local-notif-prefs:save", err),
  )
}

/**
 * Petakan payload `data` push ke jenis toggle lokal; `null` bila tak
 * terpetakan (fail-open → banner tetap tampil).
 *
 * Prioritas: `notificationType` (enum kanonis backend, mis. CHAT_NEW_MESSAGE)
 * → `type` (alias push, mis. CHAT_NEW) → `actionUrl` (mis. `/chat/<id>`).
 */
export function localKindForPushData(data: unknown): LocalNotificationKind | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = d[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
    return undefined
  }

  const typeValue = pick("notificationType", "type", "kind")
  if (typeValue) {
    const upper = typeValue.toUpperCase()
    if (upper.startsWith("CHAT_") || upper === "CHAT_NEW") return "chat"
    if (
      upper.startsWith("ORDER_") ||
      upper.startsWith("WALLET_") ||
      upper.startsWith("DISPUTE_") ||
      upper.startsWith("MILESTONE_") ||
      upper.startsWith("RATING_")
    )
      return "transaction"
    if (upper.startsWith("SHOWCASE")) return "showcase"
    if (
      upper.startsWith("VOUCHER_") ||
      upper.startsWith("CAMPAIGN_") ||
      upper.startsWith("TOPUP_BONUS_") ||
      upper.startsWith("SUBSCRIPTION_") ||
      upper.startsWith("REFERRAL_") ||
      upper === "QUESTION_UNANSWERED_REMINDER"
    )
      return "promo"
    // Tipe dikenal tapi di luar daftar toggle (keamanan, KYC, sistem, …)
    // → null = selalu tampil (fail-open).
    return null
  }

  const actionUrl = pick("actionUrl")?.toLowerCase()
  if (actionUrl) {
    if (actionUrl.includes("/chat/")) return "chat"
    if (
      actionUrl.includes("/order/") ||
      actionUrl.includes("/dispute/") ||
      actionUrl.includes("/wallet")
    )
      return "transaction"
    if (actionUrl.includes("/showcase/")) return "showcase"
  }
  return null
}
