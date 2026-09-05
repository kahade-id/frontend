/**
 * Kahade — <AppVersionInfoRow> (§3.1 Mono untuk data teknis, §9.17 ListItem
 * turunan, §12 Voice & Tone).
 *
 * Baris paling bawah halaman Pengaturan / Tentang: nama app + versi + build
 * + channel update. Dibaca pengguna hanya saat menghubungi CS ("versi berapa
 * yang Anda pakai?"), maka prioritasnya: mudah dibaca, mudah disalin, tidak
 * mencolok.
 *
 * Keputusan non-obvious:
 *   - Versi/build dirender `monoBody` text-secondary, bukan Badge: ini data
 *     teknis presisi (§3.1), dan Badge disediakan untuk status transaksi.
 *   - Menerima nilai lewat props, BUKAN membaca `expo-constants` /
 *     `expo-application` / `expo-updates` sendiri — komponen UI tetap bebas
 *     dependensi native dan bisa dirender di storybook/web tanpa runtime
 *     Expo. Pemanggil merakit: `version` dari Constants.expoConfig.version,
 *     `build` dari nativeBuildVersion, `updateId` dari Updates.updateId.
 *   - `onLongPress` (bukan onPress) untuk menyalin/menampilkan detail debug:
 *     baris ini tidak boleh terasa seperti menu (tidak ada chevron, tidak
 *     ada scale) supaya tidak mengundang tap; long-press adalah gesture
 *     "tersembunyi" yang lazim untuk info build (Android Settings, Telegram).
 *   - Tap 7x berturut-turut (`onDeveloperUnlock`) meniru Android "developer
 *     options": hitungan di-reset setelah 2 detik idle. Hanya aktif kalau
 *     prop diberikan; tidak ada state tersembunyi di build produksi biasa.
 *   - `channel` non-production diberi Badge warning agar tester langsung
 *     sadar sedang di preview/staging; production tidak diberi Badge sama
 *     sekali (bukan Badge "Production") — noise di 99% pengguna.
 *   - Hak cipta/tahun opsional lewat `footnote`; teks tidak di-hardcode
 *     agar lokalisasi (§13) dan legal copy tetap di satu tempat (pemanggil).
 */
import { useCallback, useRef } from "react"
import { Pressable, View, type ViewProps } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type AppUpdateChannel = "production" | "preview" | "development" | (string & {})

export type AppVersionInfoRowProps = Omit<ViewProps, "children"> & {
  /** Nama app tampil, mis. "Kahade" */
  appName: string
  /** Versi semver, mis. "1.4.2" */
  version: string
  /** Build number native (iOS buildNumber / Android versionCode) */
  build?: string | number
  /** ID update OTA (expo-updates) — ditampilkan terpotong */
  updateId?: string
  channel?: AppUpdateChannel
  /** Teks kecil di bawah (hak cipta, environment) */
  footnote?: string
  /** Long-press: pemanggil menyalin string versi lengkap / buka debug */
  onLongPress?: (summary: string) => void
  /** Tap 7x cepat — membuka menu developer (opsional) */
  onDeveloperUnlock?: () => void
  className?: string
}

const DEV_TAPS = 7
const DEV_TAP_WINDOW_MS = 2000

export function AppVersionInfoRow({
  appName,
  version,
  build,
  updateId,
  channel,
  footnote,
  onLongPress,
  onDeveloperUnlock,
  className,
  ...rest
}: AppVersionInfoRowProps) {
  const taps = useRef(0)
  const lastTap = useRef(0)

  const versionLine = build != null ? `${version} (${build})` : version
  const summary = [
    `${appName} ${versionLine}`,
    channel !== "production" ? channel : null,
    updateId ? `update ${updateId}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const handlePress = useCallback(() => {
    if (!onDeveloperUnlock) return
    const now = Date.now()
    taps.current = now - lastTap.current < DEV_TAP_WINDOW_MS ? taps.current + 1 : 1
    lastTap.current = now
    if (taps.current >= DEV_TAPS) {
      taps.current = 0
      onDeveloperUnlock()
    }
  }, [onDeveloperUnlock])

  const interactive = !!onLongPress || !!onDeveloperUnlock

  const content = (
    <View className={cn("w-full items-center gap-1 px-6 py-4", className)}>
      <View className="flex-row items-center gap-2">
        <Text variant="caption" tone="secondary" weight={500}>
          {appName}
        </Text>
        <Text variant="monoBody" tone="secondary" selectable={!interactive}>
          {versionLine}
        </Text>
        {channel && channel !== "production" ? (
          <Badge tone="warning" variant="outline">
            {channel}
          </Badge>
        ) : null}
      </View>

      {updateId ? (
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {updateId.length > 12 ? `${updateId.slice(0, 8)}…${updateId.slice(-4)}` : updateId}
        </Text>
      ) : null}

      {footnote ? (
        <Text variant="caption" tone="secondary" className="text-center">
          {footnote}
        </Text>
      ) : null}
    </View>
  )

  if (!interactive) {
    return (
      <View accessible accessibilityLabel={summary} {...rest}>
        {content}
      </View>
    )
  }

  // Pressable polos (bukan PressableScale): tidak ada scale/feedback visual —
  // baris ini sengaja tidak terlihat interaktif.
  return (
    <Pressable
      accessibilityRole="text"
      accessibilityLabel={summary}
      accessibilityHint={onLongPress ? "Tekan lama untuk menyalin" : undefined}
      onPress={handlePress}
      onLongPress={onLongPress ? () => onLongPress(summary) : undefined}
      delayLongPress={400}
      {...rest}
    >
      {content}
    </Pressable>
  )
}
