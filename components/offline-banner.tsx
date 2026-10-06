/**
 * Kahade — banner "Anda sedang offline" (item #27).
 *
 * Sengaja TIDAK mengganggu: bar ramping di bawah status bar, tanpa tombol
 * yang wajib ditekan, tanpa menutup konten. Tampil hanya bila NetInfo PASTI
 * melaporkan offline (bukan saat status belum diketahui — lihat
 * lib/connectivity.ts).
 *
 * Copy jujur soal dua nasib aksi:
 *   - aksi sosial (suka/ikuti) → diantrekan, terkirim otomatis saat online;
 *   - aksi lain (termasuk SEMUA yang menyentuh uang) → DITOLAK dengan pesan
 *     jelas saat offline, tidak diantrekan (fail-closed).
 */
import { View } from "react-native"
import { WifiSlash } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { useIsOnline } from "@/lib/connectivity"
import { translate } from "@/lib/i18n"

export function OfflineBanner() {
  const online = useIsOnline()
  const insets = useSafeAreaInsets()
  if (online) return null
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={translate("Anda sedang offline")}
      style={{ paddingTop: insets.top }}
      className="bg-warning-soft"
    >
      <View className="flex-row items-center gap-2 px-5 py-2">
        <Icon icon={WifiSlash} size="sm" tone="warning" />
        <View className="flex-1">
          <Text variant="label" tone="primary">
            {translate("Anda sedang offline")}
          </Text>
          <Text variant="caption" tone="secondary">
            {translate(
              "Data tersimpan tetap terlihat, tetapi mungkin belum terbaru. Suka & ikuti akan terkirim otomatis saat tersambung. Aksi lain (termasuk yang menyentuh uang) tidak bisa dilakukan saat offline.",
            )}
          </Text>
        </View>
      </View>
    </View>
  )
}
