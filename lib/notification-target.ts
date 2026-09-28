/**
 * Kahade — validasi tujuan notifikasi SEBELUM dibuka (B15).
 *
 * Masalah: ketukan notifikasi langsung `router.push` ke route hasil
 * `routeForNotificationReference`. Bila entitas tujuan sudah dihapus
 * (order dibatalkan & dibersihkan, karya dihapus, sengketa arsip), layar
 * tujuan bisa menampilkan keadaan kosong yang membingungkan tanpa
 * penjelasan.
 *
 * `checkNotificationTarget` mem-probe keberadaan entitas via endpoint GET
 * yang SUDAH ADA (tanpa mengubah kontrak/logika server):
 *   - order → `api.orders.getOrder`
 *   - dispute → `api.disputes.getDispute`
 *   - showcase → `api.showcase.getShowcaseDetail`
 *   - chat → TIDAK di-probe: layar room sudah menangani `roomGone` dengan
 *     EmptyState yang menjelaskan ("Percakapan tidak tersedia").
 *   - tipe lain / tanpa id → tidak ada probe murah → lolos apa adanya.
 *
 * Fail-open: HANYA 404 yang memblokir navigasi. Galat jaringan/timeout
 * TIDAK memblokir — pengguna tetap dibawa ke tujuan (layar tujuan punya
 * error state sendiri); memblokir saat sinyal goyah lebih buruk daripada
 * layar tujuan yang menjelaskan.
 */
import type { Href } from "expo-router"

import { api, isApiError } from "@/lib/api"
import {
  routeForNotificationReference,
  type NotificationReference,
} from "@/lib/notification-routing"
import { logWarn } from "@/lib/telemetry"

/** Batas probe keberadaan entitas (ms) — tidak boleh menahan ketukan lama. */
export const NOTIFICATION_TARGET_PROBE_TIMEOUT_MS = 8000

export type NotificationTargetCheck =
  /** Tujuan valid (atau tidak bisa di-probe) — navigasi seperti biasa. */
  | { status: "ok"; route: Href }
  /** Referensi tidak dikenali — pemanggil memakai fallback lamanya. */
  | { status: "unknown-route" }
  /** Entitas tujuan dipastikan tidak ada (404) — tampilkan fallback. */
  | { status: "unavailable"; entityLabel: string }

function normalizeType(t: string): string {
  return t.replace(/[\s_-]/g, "").toLowerCase()
}

type Probe = { label: string; run: (signal: AbortSignal) => Promise<unknown> }

function probeFor(ref: NotificationReference): Probe | null {
  const type = ref.referenceType ? normalizeType(ref.referenceType) : ""
  const id = ref.referenceId?.trim() ?? ""
  if (!type || !id) return null
  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return { label: "Order", run: (signal) => api.orders.getOrder(id, signal) }
    case "dispute":
      return { label: "Sengketa", run: (signal) => api.disputes.getDispute(id, signal) }
    case "showcase":
    case "etalase":
    case "showcaselike":
    case "showcasecomment":
      return { label: "Karya", run: (signal) => api.showcase.getShowcaseDetail(id, signal) }
    default:
      return null
  }
}

/**
 * Validasi tujuan notifikasi. Dipakai SEBELUM `router.push` dari daftar
 * notifikasi maupun CTA "Lihat …" di layar detail.
 */
export async function checkNotificationTarget(
  ref: NotificationReference,
): Promise<NotificationTargetCheck> {
  const route = routeForNotificationReference(ref)
  if (!route) return { status: "unknown-route" }
  const probe = probeFor(ref)
  if (!probe) return { status: "ok", route }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NOTIFICATION_TARGET_PROBE_TIMEOUT_MS)
  try {
    await probe.run(controller.signal)
    return { status: "ok", route }
  } catch (err) {
    if (isApiError(err) && err.status === 404) {
      return { status: "unavailable", entityLabel: probe.label }
    }
    // Fail-open: galat non-404 (jaringan/timeout) bukan bukti target hilang.
    logWarn("notification:target-probe", err)
    return { status: "ok", route }
  } finally {
    clearTimeout(timer)
  }
}
