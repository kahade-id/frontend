/**
 * Kahade — pratinjau data diagnostik laporan bug (batch 139, item F10).
 *
 * Lokasi: form "Hubungi Kami" kategori Teknis (= lapor bug). Data diagnostik
 * yang otomatis ikut terkirim harus TRANSPARAN: pengguna melihat daftarnya,
 * boleh menghapus item OPSIONAL, dan memberi persetujuan eksplisit sebelum
 * kirim. Tanpa persetujuan, data diagnostik tidak ikut terkirim.
 *
 * Karena API tiket tidak punya field diagnostik khusus (kontrak tidak
 * diubah — aturan batch), data yang disetujui dirender sebagai blok teks
 * berdelimitasi jelas di akhir pesan tiket — persis seperti yang tampil di
 * pratinjau.
 */
import * as Application from "expo-application"
import * as Device from "expo-device"
import { Platform } from "react-native"

export type DiagnosticItem = {
  /** id stabil untuk toggle hapus. */
  id: string
  label: string
  value: string
  /** false = wajib untuk diagnosis (tidak bisa dihapus). */
  removable: boolean
}

function safeString(v: unknown, fallback = "—"): string {
  return typeof v === "string" && v.trim() ? v : fallback
}

/**
 * Kumpulkan item diagnostik. Dipanggil saat section dibuka (bukan saat
 * modul di-load) agar nilai selalu segar.
 */
export function collectDiagnosticItems(): DiagnosticItem[] {
  const osName = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"
  const osVersion = safeString(Platform.OS === "web" ? undefined : Platform.Version?.toString())
  return [
    {
      id: "app-version",
      label: "Versi aplikasi",
      value: safeString(Application.nativeApplicationVersion) + ` (${safeString(Application.nativeBuildVersion, "?")})`,
      removable: false,
    },
    {
      id: "os",
      label: "Sistem operasi",
      value: `${osName} ${osVersion}`,
      removable: false,
    },
    {
      id: "device-model",
      label: "Model perangkat",
      value: safeString(Device.modelName, Device.deviceName ?? undefined),
      removable: true,
    },
    {
      id: "device-brand",
      label: "Merek perangkat",
      value: safeString(Device.brand),
      removable: true,
    },
    {
      id: "sent-at",
      label: "Waktu kirim",
      value: new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      removable: false,
    },
  ]
}

const DIAGNOSTICS_HEADER = "—— Data diagnostik (otomatis) ——"

/**
 * Render blok diagnostik yang ditempel di akhir pesan tiket — persis teks
 * yang tampil di pratinjau, supaya "yang Anda lihat = yang terkirim".
 */
export function renderDiagnosticsBlock(items: DiagnosticItem[]): string {
  const lines = items.map((i) => `${i.label}: ${i.value}`)
  return `\n\n${DIAGNOSTICS_HEADER}\n${lines.join("\n")}`
}

export function diagnosticsBlockHeader(): string {
  return DIAGNOSTICS_HEADER
}
