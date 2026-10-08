/**
 * Kahade — sheet durasi pesan sementara + sekali-lihat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Pilihan durasi ephemeral per pesan (Mati / 5 mnt / 1 jam / 1 hari /
 * 7 hari) — diteruskan ke parent sebagai `ephemeralTtlSeconds` pada
 * SendMessageDto. Copy menjelaskan pesan dihapus permanen.
 *
 * Sekali-lihat: toggle one-shot untuk pesan berikutnya (blur sampai
 * diketuk; semantik konsumsi backend lihat kontrak — frontend hanya
 * tampilan).
 */
import { Pressable, View } from "react-native"

import { EPHEMERAL_DURATION_OPTIONS } from "@/lib/chat-ephemeral"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Icon } from "@/components/ui/icon"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { CheckCircle, EyeSlash, Timer } from "phosphor-react-native"

export type ChatEphemeralSheetProps = {
  visible: boolean
  /** Durasi aktif saat ini (detik; 0 = mati). */
  currentSeconds: number
  /** Mode sekali-lihat aktif (one-shot untuk pesan berikutnya). */
  viewOnce: boolean
  onRequestClose: () => void
  onSelect: (seconds: number) => void
  /** Toggle sekali-lihat. */
  onViewOnceChange: (enabled: boolean) => void
}

export function ChatEphemeralSheet({
  visible,
  currentSeconds,
  viewOnce,
  onRequestClose,
  onSelect,
  onViewOnceChange,
}: ChatEphemeralSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Pesan sementara"
      description="Pesan berikutnya terhapus otomatis setelah durasi ini."
    >
      <View className="gap-1">
        {EPHEMERAL_DURATION_OPTIONS.map((opt) => {
          const active = opt.seconds === currentSeconds
          return (
            <Pressable
              key={opt.seconds}
              onPress={() => {
                onSelect(opt.seconds)
                onRequestClose()
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={translate("Pesan sementara: {x}", { x: opt.label })}
              className={`flex-row items-center gap-3 rounded-md border px-3 py-2.5 ${
                active ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <Icon icon={Timer} size={18} tone={active ? "active" : "default"} />
              <Text variant="body" weight={active ? 700 : 400} tone="primary" className="flex-1">
                {opt.label}
              </Text>
              {active ? <Icon icon={CheckCircle} size={18} tone="active" weight="fill" /> : null}
            </Pressable>
          )
        })}
        <Text variant="caption" tone="secondary" className="mt-2">
          Pesan yang sudah terkirim tidak berubah. Pesan kedaluwarsa dihapus
          permanen dan tidak bisa dipulihkan.
        </Text>
        <View className="mt-3 border-t border-border pt-3">
          <Switch
            value={viewOnce}
            onChange={onViewOnceChange}
            label="Sekali-lihat"
            description="Pesan berikutnya diburamkan sampai diketuk, lalu hilang setelah dibaca."
          />
          <View className="mt-2 flex-row items-center gap-2">
            <Icon icon={EyeSlash} size={16} tone="default" />
            <Text variant="caption" tone="secondary" className="flex-1">
              Catatan: aplikasi hanya menyembunyikan isi secara visual — pesan
              tetap tersimpan di server sesuai kebijakan backend.
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  )
}
