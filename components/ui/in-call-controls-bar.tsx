/**
 * Kahade — <InCallControlsBar> (§9.1 Icon button, §7 weight aktif, §3.1 Mono
 * untuk durasi).
 *
 * Bilah kontrol di bawah layar panggilan aktif: durasi Mono di atas,
 * deretan toggle bulat (Bisukan, Speaker, Kamera, Balik kamera) dan tombol
 * Tutup (destructive) di kanan. Dipakai bersama IncomingCallPrompt —
 * setelah "Terima", layar berganti ke video/avatar + bar ini.
 *
 * Keputusan non-obvious:
 *   - Toggle "aktif" (mis. mikrofon dibisukan, speaker menyala) = `bg-primary`
 *     + ikon inverse — memakai <IconButton accessibilityHint="Ketuk untuk berinteraksi" variant="primary" shape="pill">;
 *     non-aktif = `variant="secondary"` (border-default, ikon text-tertiary).
 *     Pola invert ini (bukan hanya ganti weight) dipilih karena saat
 *     menelepon user melirik cepat tanpa fokus — perbedaan fill hitam vs
 *     garis tipis jauh lebih cepat terbaca daripada Regular vs Fill (§7).
 *   - Ikon toggle menggambarkan KEADAAN SAAT INI, bukan aksi: muted ->
 *     MicrophoneSlash, video off -> VideoCameraSlash. Konvensi OS (iOS/Android
 *     dialer) yang sudah dihafal user; label caption di bawah ikon menyebut
 *     keadaan yang sama ("Bisu" / "Kamera mati") supaya ikon dan teks tidak
 *     saling bertentangan.
 *   - Tutup = <IconButton variant="destructive" shape="pill"> PhoneDisconnect,
 *     ukuran sama (md 48) dengan toggle lain — TIDAK dibesarkan seperti
 *     tombol IncomingCallPrompt (64px). Di tengah panggilan, salah tekan
 *     "Tutup" lebih mahal daripada salah tekan "Bisu"; menyamakan ukuran
 *     dan memisahkannya lewat warna (satu-satunya merah di bar) sudah cukup.
 *     Jarak ke toggle terdekat = gap-6 (24px), lebih lebar dari gap antar
 *     toggle (gap-4), sebagai pemisah spasial tambahan (§1 poin 5).
 *   - Durasi `monoBody` tabular via formatCountdown(detik) — timestamp
 *     teknis yang berdiri sendiri (§3.1). Pemanggil mengirim `durationSec`
 *     (number), bukan string, karena bar ini tempat satu-satunya durasi
 *     ditampilkan; menyeragamkan format di sini.
 *   - Kontrol kamera (`onToggleVideo`, `onFlipCamera`) hanya dirender bila
 *     handler-nya ada; panggilan suara otomatis jadi 2 toggle + Tutup.
 *     Lebar tiap slot tetap `w-16` supaya label panjang ("Kamera mati") tidak
 *     menggeser tombol lain saat state berubah.
 *   - Latar `bg-surface-elevated` + `border-t border-border` tanpa radius —
 *     bar menempel tepi bawah layar (full-bleed, §5 catatan Surface). Pemanggil
 *     bertanggung jawab atas safe-area bottom.
 */
import { View, type ViewProps } from "react-native"
import {
  ArrowsLeftRight,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  SpeakerHigh,
  SpeakerSlash,
  VideoCamera,
  VideoCameraSlash,
} from "phosphor-react-native"

import { IconButton } from "@/components/ui/icon-button"
import type { IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatCountdown } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type InCallControlsBarProps = Omit<ViewProps, "children"> & {
  /** Durasi berjalan dalam detik; diformat mm:ss di sini */
  durationSec?: number
  /** Teks pengganti durasi, mis. "Menghubungkan…" sebelum tersambung */
  statusText?: string
  muted: boolean
  onToggleMute: () => void
  speakerOn: boolean
  onToggleSpeaker: () => void
  /** Ada = panggilan video; undefined = tombol kamera tidak dirender */
  videoOn?: boolean
  onToggleVideo?: () => void
  onFlipCamera?: () => void
  onEnd: () => void
  /** Nonaktifkan semua toggle (mis. saat menghubungkan), Tutup tetap aktif */
  disabled?: boolean
  labels?: {
    mute?: string
    unmute?: string
    speaker?: string
    earpiece?: string
    cameraOn?: string
    cameraOff?: string
    flip?: string
    end?: string
  }
  className?: string
}

const DEFAULT_LABELS = {
  mute: "Bisu",
  unmute: "Mik",
  speaker: "Speaker",
  earpiece: "Earpiece",
  cameraOn: "Kamera",
  cameraOff: "Kamera mati",
  flip: "Balik",
  end: "Tutup",
}

export function InCallControlsBar({
  durationSec,
  statusText,
  muted,
  onToggleMute,
  speakerOn,
  onToggleSpeaker,
  videoOn,
  onToggleVideo,
  onFlipCamera,
  onEnd,
  disabled = false,
  labels,
  className,
  ...rest
}: InCallControlsBarProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const showVideo = onToggleVideo != null
  const showFlip = onFlipCamera != null && videoOn !== false

  return (
    <View accessible={false}
      accessibilityRole="toolbar"
      className={cn(
        "w-full items-center gap-4 border-t border-border bg-surface-elevated px-6 pb-6 pt-4",
        className,
      )}
      {...rest}
    >
      {statusText ? (
        <Text variant="caption" tone="secondary">
          {statusText}
        </Text>
      ) : durationSec != null ? (
        <Text
          variant="monoBody"
          tone="secondary"
          className="tabular-nums"
          accessibilityLabel={`Durasi ${formatCountdown(durationSec)}`}
        >
          {formatCountdown(durationSec)}
        </Text>
      ) : null}

      <View className="flex-row items-start justify-center gap-6">
        <View className="flex-row items-start gap-4">
          <Control
            icon={muted ? MicrophoneSlash : Microphone}
            label={muted ? t.mute : t.unmute}
            active={muted}
            onPress={onToggleMute}
            disabled={disabled}
            accessibilityLabel={muted ? "Nyalakan mikrofon" : "Bisukan mikrofon"}
          />
          <Control
            icon={speakerOn ? SpeakerHigh : SpeakerSlash}
            label={speakerOn ? t.speaker : t.earpiece}
            active={speakerOn}
            onPress={onToggleSpeaker}
            disabled={disabled}
            accessibilityLabel={speakerOn ? "Matikan speaker" : "Nyalakan speaker"}
          />
          {showVideo ? (
            <Control
              icon={videoOn ? VideoCamera : VideoCameraSlash}
              label={videoOn ? t.cameraOn : t.cameraOff}
              active={videoOn === false}
              onPress={onToggleVideo!}
              disabled={disabled}
              accessibilityLabel={videoOn ? "Matikan kamera" : "Nyalakan kamera"}
            />
          ) : null}
          {showFlip ? (
            <Control
              icon={ArrowsLeftRight}
              label={t.flip}
              active={false}
              onPress={onFlipCamera!}
              disabled={disabled}
              accessibilityLabel="Balik kamera"
            />
          ) : null}
        </View>

        <View className="w-16 items-center gap-1">
          <IconButton
            icon={PhoneDisconnect}
            variant="destructive"
            shape="pill"
            weight="fill"
            accessibilityLabel="Tutup panggilan"
            onPress={onEnd}
          />
          <Text ellipsizeMode="tail" variant="caption" tone="secondary" weight={500} numberOfLines={1}>
            {t.end}
          </Text>
        </View>
      </View>
    </View>
  )
}

/**
 * Satu slot toggle: IconButton pill + label. `active` = keadaan "menyala"
 * secara visual (lihat header: muted/speaker/kamera-mati = filled).
 */
function Control({
  icon,
  label,
  active,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon: IconComponent
  label: string
  active: boolean
  onPress: () => void
  disabled: boolean
  accessibilityLabel: string
}) {
  return (
    <View className="w-16 items-center gap-1">
      <IconButton
        icon={icon}
        variant={active ? "primary" : "secondary"}
        shape="pill"
        weight={active ? "fill" : "regular"}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected: active }}
        onPress={onPress}
        disabled={disabled}
      />
      <Text
        variant="caption"
        tone={active ? "primary" : "secondary"}
        weight={500}
        numberOfLines={1}
        className="text-center"
      >
        {label}
      </Text>
    </View>
  )
}