/**
 * Kahade — sheet kirim lokasi (batch 43 FE-CHAT, 2026-09-28).
 *
 * Mengambil posisi GPS saat ini (expo-location, izin foreground) + label
 * opsional, lalu mengembalikan `{ lat, lng, label }` ke parent untuk
 * dikirim sebagai pesan LOCATION.
 *
 * Tanpa pratinjau peta (tidak ada dependensi map tile pihak ketiga);
 * akurasi ditampilkan dari hasil GPS.
 */
import { useEffect, useState } from "react"
import { Linking, View } from "react-native"
import * as Location from "expo-location"

import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { MapPin, WarningCircle } from "phosphor-react-native"

export type ChatLocationResult = {
  lat: number
  lng: number
  label?: string
}

export type ChatLocationSheetProps = {
  visible: boolean
  onRequestClose: () => void
  onSend: (location: ChatLocationResult) => void
}

export function ChatLocationSheet({ visible, onRequestClose, onSend }: ChatLocationSheetProps) {
  const [loading, setLoading] = useState(false)
  /**
   * Audit Pesan 2026-10-10 (room #18): dua kegagalan dibedakan — izin DITOLAK
   * (arahkan ke pengaturan) vs posisi TIDAK TERSEDIA (GPS mati / timeout;
   * tawarkan coba lagi). Dulu keduanya "Izinkan akses lokasi di pengaturan".
   */
  const [failure, setFailure] = useState<"denied" | "unavailable" | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const [label, setLabel] = useState("")

  useEffect(() => {
    if (!visible) return
    let alive = true
    setLoading(true)
    setFailure(null)
    setCoords(null)
    if (attempt === 0) setLabel("")
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (!alive) return
        if (status !== "granted") {
          setFailure("denied")
          return
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!alive) return
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        })
      } catch (err) {
        logWarn("chat:location-fix", err)
        if (alive) setFailure("unavailable")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [visible, attempt])

  const send = () => {
    if (!coords) return
    onSend({ lat: coords.lat, lng: coords.lng, label: label.trim() || undefined })
    onRequestClose()
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Kirim lokasi"
      description="Bagikan posisi Anda saat ini ke ruang chat."
      avoidKeyboard
    >
      {loading ? (
        <View className="items-center gap-2 py-6">
          <Spinner />
          <Text variant="caption" tone="secondary">
            Mengambil posisi GPS…
          </Text>
        </View>
      ) : failure || !coords ? (
        <View className="items-center gap-2 py-4">
          <Icon icon={WarningCircle} size={28} tone="warning" />
          <Text variant="body" weight={600} tone="primary" className="text-center">
            {failure === "denied" ? translate("Akses lokasi ditolak") : translate("Posisi belum ditemukan")}
          </Text>
          <Text variant="caption" tone="secondary" className="text-center">
            {failure === "denied"
              ? translate("Izinkan akses lokasi di pengaturan perangkat, lalu coba lagi.")
              : translate("Pastikan GPS/lokasi perangkat aktif dan sinyal cukup, lalu coba lagi.")}
          </Text>
          <View className="flex-row gap-2">
            {failure === "denied" ? (
              <Button
                variant="secondary"
                fullWidth={false}
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              >
                {translate("Buka pengaturan")}
              </Button>
            ) : null}
            <Button variant="primary" fullWidth={false} onPress={() => setAttempt((n) => n + 1)}>
              {translate("Coba lagi")}
            </Button>
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <View className="flex-row items-center gap-2 rounded-md bg-surface p-3">
            <Icon icon={MapPin} size={20} tone="info" weight="fill" />
            <View className="flex-1">
              <Text variant="body" weight={600} tone="primary" className="tabular-nums">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
              {coords.accuracy != null ? (
                <Text variant="caption" tone="secondary">
                  Akurasi ±{Math.round(coords.accuracy)} m
                </Text>
              ) : null}
            </View>
          </View>
          <Input
            label="Label (opsional)"
            value={label}
            onChangeText={setLabel}
            placeholder="Mis. Titik kumpul lobi mall"
            maxLength={120}
          />
          <Button onPress={send}>Kirim lokasi ini</Button>
        </View>
      )}
    </BottomSheet>
  )
}
