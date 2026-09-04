/**
 * Kahade — <NotificationPreferencesMatrix> pengaturan notifikasi per
 * kategori × kanal (§9.5 Switch, §9.17 List Item, §4 spacing).
 *
 * Merepresentasikan `GET/PUT /v1/notifications/preferences`
 * (UpdatePreferencesDto): 17 boolean dengan pola `<kategori><Kanal>` —
 * orderInApp, orderPush, orderEmail, walletInApp, ..., marketingEmail.
 * Komponen menerima objek flat itu APA ADANYA dan memancarkan objek flat
 * yang sama lewat `onChange`, jadi layer data tidak perlu transformasi.
 *
 * Anatomi per kategori (satu blok, dipisah Divider):
 *   judul kategori (label 600) + deskripsi caption
 *   baris kanal: label kanal ..... <Switch>  (hanya kanal yang ADA di DTO)
 *
 * Keputusan non-obvious:
 *   - Bukan tabel grid kategori×kanal dengan header kolom: di lebar mobile
 *     3 kolom Switch 44px + label kategori tidak muat tanpa memotong teks.
 *     Daftar bertumpuk lebih panjang, tapi tiap Switch punya label sendiri
 *     (a11y) dan tidak ada ambiguitas baris/kolom.
 *   - Kanal yang tidak tersedia untuk kategori (mis. chat tidak punya email,
 *     marketing hanya email) TIDAK dirender sebagai Switch disabled — cukup
 *     tidak ada. Matriks `CATEGORY_CHANNELS` = sumber kebenaran bentuk DTO.
 *   - Komponen controlled: `value` + `onChange(next)`; tidak menyimpan state
 *     sendiri. Pemanggil bebas debounce PUT atau menyimpan lewat tombol.
 *   - `securityInApp` & `securityPush` boleh dikunci lewat `lockedKeys`
 *     (Switch disabled + caption "Wajib") — notifikasi keamanan adalah §14.
 *   - Deskripsi kategori & label kanal bisa ditimpa via `labels` (§12 i18n).
 */
import { Fragment } from "react"
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type NotificationChannel = "InApp" | "Push" | "Email"
export type NotificationCategory = "order" | "wallet" | "security" | "chat" | "dispute" | "ranking" | "marketing"

export type NotificationPreferenceKey = `${NotificationCategory}${NotificationChannel}`

/** Bentuk flat sesuai UpdatePreferencesDto */
export type NotificationPreferences = Partial<Record<NotificationPreferenceKey, boolean>>

/** Kanal yang tersedia per kategori — mengikuti field yang ada di DTO */
export const CATEGORY_CHANNELS: Record<NotificationCategory, readonly NotificationChannel[]> = {
  order: ["InApp", "Push", "Email"],
  wallet: ["InApp", "Push", "Email"],
  security: ["InApp", "Push", "Email"],
  chat: ["InApp", "Push"],
  dispute: ["InApp", "Push", "Email"],
  ranking: ["InApp", "Push"],
  marketing: ["Email"],
}

export const CATEGORY_ORDER: readonly NotificationCategory[] = ["order", "wallet", "security", "dispute", "chat", "ranking", "marketing"]

export type NotificationPreferencesLabels = {
  categories: Record<NotificationCategory, { title: string; description: string }>
  channels: Record<NotificationChannel, string>
  locked: string
}

const DEFAULT_LABELS: NotificationPreferencesLabels = {
  categories: {
    order: { title: "Transaksi", description: "Pembayaran, pengiriman, konfirmasi, dan tenggat order." },
    wallet: { title: "Dompet", description: "Top-up, penarikan, transfer, dan mutasi saldo." },
    security: { title: "Keamanan", description: "Login baru, perubahan kata sandi, dan perangkat." },
    dispute: { title: "Sengketa", description: "Pesan, bukti, dan keputusan sengketa." },
    chat: { title: "Pesan", description: "Pesan baru dari lawan transaksi." },
    ranking: { title: "Peringkat & lencana", description: "Perubahan skor kepercayaan dan lencana baru." },
    marketing: { title: "Promo & info", description: "Penawaran, voucher, dan pembaruan fitur." },
  },
  channels: { InApp: "Di aplikasi", Push: "Push", Email: "Email" },
  locked: "Wajib",
}

export type NotificationPreferencesMatrixProps = Omit<ViewProps, "children"> & {
  value: NotificationPreferences
  onChange: (next: NotificationPreferences, changedKey: NotificationPreferenceKey) => void
  /** Kunci yang tidak boleh dimatikan (Switch disabled) */
  lockedKeys?: readonly NotificationPreferenceKey[]
  /** Batasi kategori yang ditampilkan (default semua) */
  categories?: readonly NotificationCategory[]
  disabled?: boolean
  labels?: {
    categories?: Partial<Record<NotificationCategory, Partial<{ title: string; description: string }>>>
    channels?: Partial<Record<NotificationChannel, string>>
    locked?: string
  }
  className?: string
}

export function NotificationPreferencesMatrix({
  value,
  onChange,
  lockedKeys = [],
  categories = CATEGORY_ORDER,
  disabled = false,
  labels,
  className,
  ...rest
}: NotificationPreferencesMatrixProps) {
  const channelLabels = { ...DEFAULT_LABELS.channels, ...labels?.channels }
  const lockedLabel = labels?.locked ?? DEFAULT_LABELS.locked

  return (
    <View className={cn("gap-5", className)} {...rest}>
      {categories.map((cat, i) => {
        const base = DEFAULT_LABELS.categories[cat]
        const title = labels?.categories?.[cat]?.title ?? base.title
        const description = labels?.categories?.[cat]?.description ?? base.description

        return (
          <Fragment key={cat}>
            {i > 0 ? <Divider /> : null}
            {/* Tanpa accessibilityLabel/`accessible`: grup ini berisi Switch yang harus
                tetap fokusable. Konteks kategori sudah ada di label tiap Switch
                ("<kategori>, <kanal>") — audit #4. */}
            <View className="gap-3">
              <View className="gap-0.5">
                <Text variant="label" tone="primary">
                  {title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {description}
                </Text>
              </View>

              <View className="gap-2">
                {CATEGORY_CHANNELS[cat].map((ch) => {
                  const key = `${cat}${ch}` as NotificationPreferenceKey
                  const locked = lockedKeys.includes(key)
                  const on = value[key] ?? false
                  return (
                    <View key={key} className="min-h-11 flex-row items-center justify-between gap-3">
                      <View className="flex-1 flex-row items-center gap-2">
                        <Text variant="body" tone={disabled ? "disabled" : "primary"}>
                          {channelLabels[ch]}
                        </Text>
                        {locked ? (
                          <Text variant="caption" tone="secondary">
                            {lockedLabel}
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        value={locked ? true : on}
                        disabled={disabled || locked}
                        onChange={(next) => onChange({ ...value, [key]: next }, key)}
                        accessibilityLabel={`${title}, ${channelLabels[ch]}`}
                      />
                    </View>
                  )
                })}
              </View>
            </View>
          </Fragment>
        )
      })}
    </View>
  )
}
