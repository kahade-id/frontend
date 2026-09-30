/**
 * Kahade — <AvatarPreviewDialog> (Batch 139, E02).
 *
 * Dialog pratinjau SEBELUM avatar diunggah:
 *   - gambar tampil dalam MASKER LINGKARAN persis seperti foto profil nanti
 *     (sudut yang terpotong terlihat jelas di sini, bukan setelah terunggah);
 *   - catatan batas aman: jaga wajah/teks penting di tengah lingkaran;
 *   - "Batal" membuang pilihan, "Gunakan Foto Ini" mengunggah (loading
 *     selama upload).
 *
 * Dipakai edit-profile.tsx dan profile-edit-sheet.tsx (keduanya memakai
 * useAvatarUpload yang kini menahan aset di `preview`).
 */
import { View } from "react-native"
import { Image } from "expo-image"

import type { PickedImage } from "@/lib/image-picker"
import { translate } from "@/lib/i18n/translate"

import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"

export function AvatarPreviewDialog({
  asset,
  busy,
  onConfirm,
  onCancel,
}: {
  asset: PickedImage | null
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      title={translate("Pratinjau foto profil")}
      description={translate(
        "Foto profil tampil sebagai lingkaran — pastikan wajah atau objek penting berada di tengah.",
      )}
      visible={asset !== null}
      confirmLabel={translate("Gunakan foto ini")}
      cancelLabel={translate("Batal")}
      loading={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onRequestClose={onCancel}
    >
      {asset ? (
        <View className="items-center gap-3 py-2">
          {/* Masker lingkaran 160px — replika Avatar size besar.
              PERF-FIX (2026-09-30): expo-image (bukan RN Image) — decode di
              background thread + disk cache; foto picker 4000px+ tidak
              menjank dialog. */}
          <View className="h-40 w-40 overflow-hidden rounded-full bg-surface">
            <Image
              source={{ uri: asset.uri }}
              style={{ width: 160, height: 160 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              // UX-A11Y-014: tanpa `accessible` + role, expo-image
              // mengabaikan label — SR melewati pratinjau tanpa menyebutnya.
              accessible
              accessibilityRole="image"
              accessibilityLabel={translate("Pratinjau foto profil baru")}
            />
          </View>
          <Text variant="caption" tone="secondary" className="text-center">
            {translate("Sudut foto di luar lingkaran akan terpotong.")}
          </Text>
        </View>
      ) : null}
    </Dialog>
  )
}
