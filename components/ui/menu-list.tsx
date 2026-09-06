/**
 * Kahade — <MenuList> + <MenuItem> (komposisi §9.17 untuk layar pengaturan).
 *
 * Daftar menu berkelompok (Akun, Keamanan, Bantuan) seperti di layar Profil:
 * kartu ber-border (`ListGroup`) berisi baris <ListItem> dengan ikon di kiri,
 * chevron di kanan, dan divider otomatis di antara baris — pemanggil TIDAK
 * perlu menandai `divider` per item; MenuList menghitungnya dari posisi anak
 * lewat Children.toArray, sehingga baris terakhir tidak punya garis ganda
 * dengan border kartu.
 *
 * MenuItem hanya pembungkus ListItem dengan default yang tepat untuk menu:
 * chevron aktif, ikon leading dalam <IconBox size="sm" variant="surface">
 * (bidang ber-border kecil agar deretan ikon rapi walau glyph berbeda
 * lebar), dan `value` teks kanan untuk setting yang punya nilai ("Bahasa →
 * Indonesia"). `destructive` untuk "Keluar"/"Hapus akun".
 *
 * `title` opsional di atas kartu memakai <Text variant="label" tone=
 * "secondary"> — bukan ALL CAPS (§3.2).
 */
import { Children, isValidElement, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListGroup, ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type MenuListProps = Omit<ViewProps, "children"> & {
  title?: string
  /** Teks kecil di bawah kartu (mis. versi aplikasi) */
  footer?: string
  children: ReactNode
  className?: string
}

export function MenuList({ title, footer, children, className, ...rest }: MenuListProps) {
  const rows = Children.toArray(children).filter(isValidElement)

  return (
    <View accessible={false} className={cn("w-full gap-2", className)} {...rest}>
      {title ? (
        <Text variant="label" tone="secondary" className="px-1">
          {title}
        </Text>
      ) : null}
      <ListGroup>
        {rows.map((child, i) => (
          <View key={child.key ?? i} className={cn(i < rows.length - 1 && "border-b border-border")}>
            {child}
          </View>
        ))}
      </ListGroup>
      {footer ? (
        <Text variant="caption" tone="secondary" className="px-1">
          {footer}
        </Text>
      ) : null}
    </View>
  )
}

export type MenuItemProps = Omit<ListItemProps, "leading" | "trailing" | "divider" | "inset" | "className"> & {
  icon?: IconComponent
  /** Nilai setting di kanan (mis. "Indonesia", "Aktif") */
  value?: string
  /** Node kanan kustom (mis. <Switch>) — mematikan chevron */
  trailing?: ReactNode
  className?: string
}

export function MenuItem({ icon, value, trailing, chevron, destructive, className, ...rest }: MenuItemProps) {
  return (
    <ListItem
      leading={
        icon ? <IconBox icon={icon} size="sm" variant={destructive ? "danger" : "surface"} /> : undefined
      }
      trailing={trailing ?? value}
      chevron={chevron ?? (trailing == null)}
      destructive={destructive}
      className={cn("px-4", className)}
      {...rest}
    />
  )
}
