/**
 * Kahade — location viewer halaman media terpusat (`type=location`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): teks putih di atas hitam solid kedua
 * mode untuk chrome — preseden showcase-media-gallery.
 *
 * Peta full IN-APP (WebView embed OpenStreetMap — tanpa API key, tanpa SDK
 * peta native): pin di koordinat + tombol "Rute" yang membuka panduan arah
 * IN-APP (halaman directions OSM di WebView yang sama) + tombol bagikan
 * tautan lokasi. TIDAK PERNAH melempar ke aplikasi peta luar.
 *
 * Keputusan non-obvious:
 *   - Tile OSM hanya dimuat SETELAH user membuka halaman ini (niat eksplisit) —
 *     bubble chat memakai mini-map vektor lokal (tanpa request pihak ketiga).
 *   - Mode "rute": tanpa GPS user di URL (privasi) — halaman directions OSM
 *     membiarkan user mengisi titik awal sendiri / memakai tombol locate
 *     bawaan OSM. Tombol "Lokasi saya" memakai expo-location hanya bila
 *     diizinkan (fallback: pesan akurat, bukan crash).
 *   - WebView dibungkus error boundary: APK lama tanpa modul → kartu info
 *     lokasi + bagikan (tetap berguna, bukan crash).
 */
import { Component, useCallback, useRef, useState, type ReactNode } from "react"
import { View } from "react-native"
import { Crosshair, MapPin, NavigationArrow, ShareNetwork } from "phosphor-react-native"
import { WebView } from "react-native-webview"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { tokens } from "@/lib/tokens"
import { shareContent } from "@/lib/share"

export type LocationViewerProps = {
  lat: number
  lng: number
  label?: string | null
}

class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function embedMapUrl(lat: number, lng: number): string {
  // Bbox ±0.01° (~1 km) di sekitar pin, zoom 16.
  const bbox = `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function directionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=14/${lat}/${lng}`
}

export function shareableLocationUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
}

export function LocationViewer({ lat, lng, label }: LocationViewerProps) {
  const toast = useToast()
  const [mode, setMode] = useState<"map" | "route">("map")
  const [failed, setFailed] = useState(false)
  const [locating, setLocating] = useState(false)
  // react-native-webview v14 mengetik ref sebagai `unknown` — cast di call-site.
  const webRef = useRef<unknown>(null)
  const displayLabel = label?.trim() || "Lokasi dibagikan"

  const reloadMap = () => (webRef.current as { reload?: () => void } | null)?.reload?.()
  const navigateMap = (target: string) =>
    (webRef.current as { injectJavaScript?: (js: string) => void } | null)?.injectJavaScript?.(
      `window.location.href = "${target}"; true;`,
    )

  const shareLocation = useCallback(async () => {
    const outcome = await shareContent({
      message: `${displayLabel}\n${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      url: shareableLocationUrl(lat, lng),
      title: displayLabel,
    })
    if (outcome === "unavailable") {
      toast.show({ title: "Berbagi tidak tersedia di perangkat ini", tone: "warning" })
    }
  }, [displayLabel, lat, lng, toast])

  const centerOnPin = useCallback(() => {
    // Muat ulang embed = kembali ke pin (tanpa JS injection).
    reloadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locateMe = useCallback(async () => {
    if (locating) return
    setLocating(true)
    try {
      const Location = await import("expo-location")
      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status !== "granted") {
        toast.show({
          title: "Izin lokasi ditolak",
          description: "Aktifkan izin lokasi di Pengaturan perangkat untuk melihat posisi Anda di peta.",
          tone: "warning",
        })
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      // Arahkan WebView ke rute dari posisi user → pin (tetap in-app).
      const from = `${pos.coords.latitude},${pos.coords.longitude}`
      const to = `${lat},${lng}`
      navigateMap(
        `https://www.openstreetmap.org/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}#map=12/${lat}/${lng}`,
      )
      setMode("route")
    } catch {
      toast.show({
        title: "Lokasi tidak ditemukan",
        description: "Pastikan GPS aktif dan Anda berada di area dengan sinyal baik.",
        tone: "danger",
      })
    } finally {
      setLocating(false)
    }
  }, [lat, lng, locating, toast])

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-black px-8">
        <View className="items-center justify-center rounded-full bg-overlay-media p-4">
          <Icon icon={MapPin} size="lg" color={tokens.colors.light.primaryForeground} />
        </View>
        <Text variant="body" weight={600} className="mt-2 text-center text-white">
          {displayLabel}
        </Text>
        <Text variant="body" className="text-center text-white opacity-80 tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
        <Text variant="body" className="text-center text-white opacity-80">
          Peta gagal dimuat. Periksa koneksi internet Anda, lalu coba lagi.
        </Text>
        <PressableScale
          onPress={() => setFailed(false)}
          accessibilityRole="button"
          accessibilityLabel="Muat ulang peta"
          className="mt-3 rounded-full bg-white px-5 py-2.5"
        >
          <Text variant="body" weight={600} className="text-black">
            Coba lagi
          </Text>
        </PressableScale>
      </View>
    )
  }

  const sourceUri = mode === "map" ? embedMapUrl(lat, lng) : directionsUrl(lat, lng)

  return (
    <View className="flex-1 bg-black">
      <MapBoundary
        fallback={
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Text variant="body" weight={600} className="text-center text-white">
              {displayLabel}
            </Text>
            <Text variant="body" className="text-center text-white opacity-80 tabular-nums">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
            <Text variant="body" className="text-center text-white opacity-80">
              Pratinjau peta tidak tersedia di versi aplikasi ini. Perbarui aplikasi untuk melihat peta.
            </Text>
          </View>
        }
      >
        <WebView
          // Callback ref: tipe ref webview v14 (`unknown`) menolak objek ref.
          ref={(node) => {
            webRef.current = node
          }}
          source={{ uri: sourceUri }}
          originWhitelist={["https://*"]}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View className="absolute inset-0 items-center justify-center gap-3 bg-black">
              <Spinner size="md" tone="inverse" />
              <Text variant="body" className="text-white">
                Memuat peta…
              </Text>
            </View>
          )}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
        />
      </MapBoundary>

      {/* Kartu bawah: label + koordinat + aksi (mode-aware agar kontras). */}
      <View className="gap-2 border-t border-border bg-surface-elevated p-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={MapPin} size="sm" tone="info" weight="fill" />
          <View className="min-w-0 flex-1">
            <Text variant="body" weight={600} numberOfLines={1}>
              {displayLabel}
            </Text>
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <PressableScale
            onPress={() => setMode((m) => (m === "map" ? "route" : "map"))}
            accessibilityRole="button"
            accessibilityLabel={mode === "map" ? "Lihat rute ke lokasi ini" : "Kembali ke peta"}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-sm bg-primary px-3 py-2.5"
          >
            <Icon
              icon={NavigationArrow}
              size="sm"
              color={tokens.colors.light.primaryForeground}
              weight="fill"
            />
            <Text variant="body" weight={600} tone="inverse">
              {mode === "map" ? "Rute" : "Peta"}
            </Text>
          </PressableScale>
          <PressableScale
            onPress={() => void locateMe()}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Tampilkan rute dari lokasi saya"
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-sm bg-surface px-3 py-2.5 ${locating ? "opacity-50" : ""}`}
          >
            {locating ? (
              <Spinner size="sm" />
            ) : (
              <Icon icon={Crosshair} size="sm" tone="active" />
            )}
            <Text variant="body" weight={600}>
              Lokasi saya
            </Text>
          </PressableScale>
          <PressableScale
            onPress={centerOnPin}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke pin lokasi"
            className="flex-row items-center justify-center gap-1.5 rounded-sm bg-surface px-3 py-2.5"
          >
            <Icon icon={MapPin} size="sm" tone="active" />
          </PressableScale>
          <PressableScale
            onPress={() => void shareLocation()}
            accessibilityRole="button"
            accessibilityLabel="Bagikan lokasi"
            className="flex-row items-center justify-center gap-1.5 rounded-sm bg-surface px-3 py-2.5"
          >
            <Icon icon={ShareNetwork} size="sm" tone="active" />
          </PressableScale>
        </View>
      </View>
    </View>
  )
}
