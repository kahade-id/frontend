/**
 * Kahade — <ActionSheet> (§10 "action menu" -> BottomSheet).
 *
 * Daftar aksi kontekstual (mis. di detail transaksi: "Salin ID", "Unduh
 * bukti", "Laporkan masalah", "Batalkan transaksi"). Dibangun di atas
 * <BottomSheet> agar animasi, backdrop, dan aturan stacking (§9.9) ikut.
 *
 * Keputusan non-obvious:
 *   - Setiap aksi adalah baris penuh (min-h 52px) dengan ikon kiri opsional,
 *     dipisah <Divider>. Bukan grid ikon ala iOS share sheet — konsisten
 *     dengan List Item (§9.17) & mudah dibaca satu tangan.
 *   - `scaleOnPress={false}`: baris lebar penuh yang mengecil 3% terlihat
 *     "goyang"; feedback pressed cukup `active:bg-surface` (kontras fill).
 *   - Aksi destruktif memakai teks `danger` DAN ikon tone danger — satu-
 *     satunya tempat ikon ikut merah (bukan input error §7), karena di menu
 *     ikon adalah bagian dari label aksi, bukan dekorasi field.
 *   - Aksi otomatis menutup sheet SEBELUM memanggil `onPress` (§9.9): kalau
 *     aksi itu membuka sheet lain (mis. konfirmasi), sheet ini sudah tutup
 *     lebih dulu. Set `closeOnSelect={false}` per aksi bila perlu tetap
 *     terbuka (jarang).
 *   - Tombol "Batal" sebagai footer secondary (outline), bukan baris ke-N:
 *     memisahkan "keluar" dari daftar aksi secara visual dan menempel di atas
 *     safe-area.
 *   - Focus ring keyboard (web saja) `focusRingInset`: baris lebar penuh di
 *     dalam sheet yang `overflow-hidden` (radius atas) — ring luar terpotong.
 */
import { View } from "react-native"

import { BottomSheet, type BottomSheetProps } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ActionSheetItem = {
  key: string
  label: string
  description?: string
  icon?: IconComponent
  destructive?: boolean
  disabled?: boolean
  onPress?: () => void
  /** Tutup sheet sebelum onPress (default true) */
  closeOnSelect?: boolean
}

export type ActionSheetProps = Omit<
  BottomSheetProps,
  "children" | "footer" | "contentClassName" | "dragArea"
> & {
  actions: readonly ActionSheetItem[]
  cancelLabel?: string
  /** Sembunyikan tombol batal (backdrop/drag tetap bisa menutup) */
  hideCancel?: boolean
}

export function ActionSheet({
  actions,
  cancelLabel = "Batal",
  hideCancel = false,
  onRequestClose,
  ...sheetProps
}: ActionSheetProps) {
  return (
    <BottomSheet
      onRequestClose={onRequestClose}
      // Seluruh sheet bisa di-drag: tidak ada konten scroll di dalamnya
      dragArea="full"
      contentClassName="px-0 pt-0 pb-0"
      footer={
        hideCancel ? undefined : (
          <Button variant="secondary" onPress={onRequestClose}>
            {cancelLabel}
          </Button>
        )
      }
      {...sheetProps}
    >
      <View accessible={false} accessibilityRole="menu">
        {actions.map((item, i) => (
          <View key={item.key}>
            {i > 0 ? <Divider /> : null}
            <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
              accessibilityRole="menuitem"
              scaleOnPress={false}
              disabled={item.disabled}
              onPress={() => {
                if (item.closeOnSelect ?? true) onRequestClose?.()
                item.onPress?.()
              }}
              containerClassName={cn("w-full", focusRingInset)}
              className={cn(
                "min-h-[52px] flex-row items-center gap-2 px-6 py-3 active:bg-surface",
              )}
            >
              {item.icon ? (
                <Icon icon={item.icon} size="sm" tone={item.destructive ? "danger" : "active"} />
              ) : null}
              <View className="flex-1 gap-[2px]">
                <Text
                  variant="body"
                  weight={500}
                  tone={item.destructive ? "danger" : "primary"}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.description ? (
                  <Text variant="caption" tone="secondary" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}