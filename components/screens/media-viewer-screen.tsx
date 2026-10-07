/**
 * Kahade — HALAMAN MEDIA TERPUSAT (`/media-viewer`).
 *
 * Satu-satunya tempat melihat media full-screen: foto (album + zoom), video
 * (player lengkap), berkas (pratinjau in-app), audio (voice note), dan lokasi
 * (peta in-app). Param: `type`, `url`, `title`, `mimeType` (+ `fileName`,
 * `fileSize`, `items`, `index`, `variants`, `lat/lng/label`, `sentAt`).
 *
 * Dinavigasi SELALU lewat `mediaViewerHref()` + `router.push(...)` — tidak ada
 * rute media full-screen lain, dan tidak ada media yang dilempar ke browser luar.
 *
 * Keputusan non-obvious:
 *   - StatusBar dipaksa terang selama halaman ini tampil (latar selalu hitam di
 *     kedua mode) — dikembalikan otomatis saat unmount oleh StatusBar root.
 *   - Param TIDAK dipercaya mentah: `parseMediaViewerParams` memvalidasi dan
 *     memberi alasan akurat bila rusak (deep-link basi / URL hilang).
 *   - Kembali: `router.back()` bila ada riwayat, kalau tidak (deep-link langsung)
 *     jatuh ke Beranda — jangan halaman hitam buntu.
 */
import { useCallback, useMemo } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { AudioViewer } from "@/components/media-viewer/audio-viewer"
import { FileViewer } from "@/components/media-viewer/file-viewer"
import { LocationViewer } from "@/components/media-viewer/location-viewer"
import { PhotoViewer } from "@/components/media-viewer/photo-viewer"
import { FullVideoPlayer } from "@/components/media-viewer/video-player"
import { ViewerError, ViewerScaffold } from "@/components/media-viewer/viewer-chrome"
import { parseMediaViewerParams } from "@/lib/media-viewer"

export default function MediaViewerScreen() {
  const raw = useLocalSearchParams()
  const parsed = useMemo(() => parseMediaViewerParams(raw as Record<string, unknown>), [raw])

  const goBack = useCallback(() => {
    try {
      if (router.canGoBack()) router.back()
      else router.replace("/")
    } catch {
      router.replace("/")
    }
  }, [])

  if (!parsed.ok) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <ViewerScaffold title="Media" onBack={goBack}>
          <ViewerError title="Media tidak bisa dibuka" description={parsed.reason} />
        </ViewerScaffold>
      </View>
    )
  }

  const params = parsed.value
  const headerTitle = params.title ?? params.fileName ?? null

  // Foto & video membawa chrome-nya sendiri (penghitung album / kontrol).
  if (params.type === "photo") {
    const items =
      params.items?.length
        ? params.items
        : params.url
          ? [{ url: params.url, title: headerTitle ?? undefined, mimeType: params.mimeType, fileName: params.fileName, fileSize: params.fileSize }]
          : []
    if (items.length === 0) {
      return (
        <View className="flex-1 bg-black">
          <StatusBar style="light" />
          <ViewerScaffold title="Foto" onBack={goBack}>
            <ViewerError title="Foto tidak bisa dibuka" description="Tautan foto tidak ditemukan." />
          </ViewerScaffold>
        </View>
      )
    }
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <PhotoViewer items={items} index={params.index ?? 0} sentAt={params.sentAt} onClose={goBack} />
      </View>
    )
  }

  if (params.type === "video" && params.url) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <FullVideoPlayer
          url={params.url}
          title={headerTitle}
          mimeType={params.mimeType}
          fileName={params.fileName}
          initialDurationSeconds={params.durationSeconds}
          variants={params.variants}
          onClose={goBack}
        />
      </View>
    )
  }

  if (params.type === "location" && params.lat != null && params.lng != null) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <ViewerScaffold title={params.label || "Lokasi"} subtitle={`${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}`} onBack={goBack}>
          <LocationViewer lat={params.lat} lng={params.lng} label={params.label} />
        </ViewerScaffold>
      </View>
    )
  }

  if (params.type === "audio" && params.url) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <ViewerScaffold title={headerTitle ?? "Pesan suara"} onBack={goBack}>
          <AudioViewer url={params.url} title={headerTitle} fileName={params.fileName} />
        </ViewerScaffold>
      </View>
    )
  }

  if (params.type === "file" && params.url) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <ViewerScaffold title={headerTitle ?? "Berkas"} onBack={goBack}>
          <FileViewer
            url={params.url}
            title={headerTitle}
            mimeType={params.mimeType}
            fileName={params.fileName}
            fileSize={params.fileSize}
          />
        </ViewerScaffold>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <ViewerScaffold title="Media" onBack={goBack}>
        <ViewerError title="Media tidak bisa dibuka" description="Tautan media tidak valid: URL berkas tidak ditemukan." />
      </ViewerScaffold>
    </View>
  )
}
