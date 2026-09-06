/**
 * Kahade — <PrivacyToggleList> (GET/PUT /v1/settings/privacy, PUT /v1/notifications/preferences).
 *
 * Daftar toggle boolean berkelompok (privasi, notifikasi) di dalam satu
 * ListGroup ber-border. Setiap baris: judul, deskripsi, Switch di kanan.
 *
 * Keputusan non-obvious:
 *   - `pendingKeys` menampilkan spinner kecil per baris saat PUT berjalan —
 *     toggle optimistik tetap terasa responsif, tapi user tahu belum tersimpan.
 *   - Bekerja untuk objek kunci apa saja (UpdatePrivacyDto hanya 2 field,
 *     UpdatePreferencesDto 17 field) lewat generic `K`.
 */
import { View, type ViewProps } from "react-native"

import { ListGroup } from "@/components/ui/list-item"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type PrivacyToggleItem<K extends string = string> = {
  key: K
  title: string
  description?: string
  disabled?: boolean
}

export type PrivacyToggleListProps<K extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly PrivacyToggleItem<K>[]
  value: Partial<Record<K, boolean>>
  onChange: (key: K, next: boolean, all: Partial<Record<K, boolean>>) => void
  /** Kunci yang sedang disimpan ke server */
  pendingKeys?: readonly K[]
  disabled?: boolean
  title?: string
  footer?: string
  className?: string
}

export function PrivacyToggleList<K extends string = string>({
  items,
  value,
  onChange,
  pendingKeys = [],
  disabled = false,
  title,
  footer,
  className,
  ...rest
}: PrivacyToggleListProps<K>) {
  return (
    <View accessible={false} className={cn("w-full gap-2", className)} {...rest}>
      {title ? (
        <Text accessibilityHint="Ketuk untuk detail" variant="label" tone="secondary" className="px-1">
          {title}
        </Text>
      ) : null}

      <ListGroup>
        {items.map((item, i) => {
          const checked = !!value[item.key]
          const pending = pendingKeys.includes(item.key)
          const rowDisabled = disabled || item.disabled || pending
          return (
            <View key={item.key} className={cn(i > 0 && "border-t border-border")}>
              <View className="min-h-14 flex-row items-center gap-3 px-5 py-3">
                <View className="flex-1 gap-[2px]">
                  <Text variant="body" weight={500} tone={rowDisabled ? "disabled" : "primary"}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" tone="secondary">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {pending ? <Spinner size="sm" /> : null}
                <Switch
                  value={checked}
                  disabled={rowDisabled}
                  onChange={(next) => onChange(item.key, next, { ...value, [item.key]: next })}
                  accessibilityLabel={item.title}
                />
              </View>
            </View>
          )
        })}
      </ListGroup>

      {footer ? (
        <Text variant="caption" tone="secondary" className="px-1">
          {footer}
        </Text>
      ) : null}
    </View>
  )
}
