/**
 * Kahade — <TransferRecipientPicker> (§9.2 Input varian Search, §9.8 Avatar,
 * §9.17 List Item, §9.12 Empty State, §12 Voice & Tone).
 *
 * Langkah pertama alur "Transfer saldo" (`POST /v1/wallet/transfer`): pengguna
 * mengetik username, komponen menampilkan hasil `GET /v1/wallet/transfer/
 * lookup` dan daftar penerima terakhir. Transfer hanya boleh ke pengguna
 * yang sudah KYC — komponen menampilkan status itu, bukan menyembunyikan
 * pengguna yang belum verifikasi.
 *
 * Anatomi: <SearchField> di atas -> (mengetik) hasil lookup / (kosong)
 * "Terakhir" -> tiap baris: Avatar + nama + @username + Badge KYC.
 *
 * Keputusan non-obvious:
 *   - Lookup adalah tugas pemanggil (debounce, fetch, cache): komponen
 *     menerima `results`, `loading`, `query`, `onQueryChange`. Pola ini
 *     sama dengan <SearchOverlay>/<UserDiscoverResultItem> — komponen UI
 *     tidak memegang jaringan.
 *   - Pengguna yang belum KYC (`kycVerified: false`) TETAP tampil, dengan
 *     `disabled` + Badge outline "Belum verifikasi": server pasti menolak
 *     transfer ke akun ini, dan menampilkannya mencegah pengguna mengira
 *     salah ketik username. Badge netral, bukan danger — status akun orang
 *     lain bukan error pengguna (§2.3).
 *   - Baris dibangun dari <PressableScale> + anatomi ListItem (`px-6 py-3
 *     gap-3`, divider inset ml-[76px] = px-6 + Avatar md 40 + gap-3 12),
 *     bukan <ListItem>, karena trailing berisi Badge + ikon check dan
 *     leading adalah Avatar dengan `verified` — ListItem membatasi title/
 *     subtitle ke string. Alasan yang sama dengan <DeviceSessionListItem>.
 *   - Penerima terpilih (`value`) ditandai ikon CheckCircle weight fill
 *     tone active (§7 ikon selected), BUKAN fill baris: daftar tetap tenang
 *     dan pengguna bisa mengganti pilihan tanpa "melompat".
 *   - "Terakhir" (`recent`) hanya tampil bila `query` kosong — saat mengetik,
 *     yang relevan adalah hasil lookup. Judul section memakai `label`
 *     (13/600), bukan h3: ini pengelompokan, bukan judul layar.
 *   - Empty state hasil lookup memakai <EmptyState> compact dengan ikon
 *     UserCircle text-tertiary (§9.12) dan copy formal "Anda" (§12).
 *   - Username dirender `monoBody` text-secondary: username adalah
 *     identifier yang diketik ulang persis (§3.1 data presisi), bukan teks
 *     naratif.
 */
import { CheckCircle, UserCircle } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SearchField } from "@/components/ui/search-field"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type TransferRecipient = {
  id: string
  name: string
  username: string
  avatarUrl?: string
  kycVerified?: boolean
}

export type TransferRecipientPickerLabels = {
  placeholder: string
  recent: string
  results: string
  notVerified: string
  emptyTitle: string
  emptyBody: string
  selected: string
}

export type TransferRecipientPickerProps = Omit<ViewProps, "children"> & {
  query: string
  onQueryChange: (q: string) => void
  /** Hasil lookup untuk `query` saat ini */
  results?: TransferRecipient[]
  /** Penerima yang pernah dipakai; tampil saat query kosong */
  recent?: TransferRecipient[]
  loading?: boolean
  /** id penerima terpilih */
  value?: string
  onSelect: (recipient: TransferRecipient) => void
  labels?: Partial<TransferRecipientPickerLabels>
  className?: string
}

const DEFAULT_LABELS: TransferRecipientPickerLabels = {
  placeholder: "Cari username penerima",
  recent: "Terakhir",
  results: "Hasil pencarian",
  notVerified: "Belum verifikasi",
  emptyTitle: "Pengguna tidak ditemukan",
  emptyBody: "Periksa kembali username yang Anda masukkan.",
  selected: "terpilih",
}

function RecipientRow({
  recipient,
  selected,
  divider,
  onSelect,
  t,
}: {
  recipient: TransferRecipient
  selected: boolean
  divider: boolean
  onSelect: (r: TransferRecipient) => void
  t: TransferRecipientPickerLabels
}) {
  const disabled = recipient.kycVerified !== true
  const verificationLabel =
    recipient.kycVerified === false ? t.notVerified : "Verifikasi belum diketahui"
  return (
    <View>
      <PressableScale
        scaleOnPress={false}
        disabled={disabled}
        onPress={() => onSelect(recipient)}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${recipient.name}, @${recipient.username}${
          disabled ? `, ${verificationLabel}` : ""
        }${selected ? `, ${t.selected}` : ""}`}
        className="flex-row items-center gap-3 px-6 py-3"
      >
        <Avatar
          source={recipient.avatarUrl}
          name={recipient.name}
          size="md"
          verified={recipient.kycVerified}
        />
        <View className="flex-1 gap-0">
          <Text
            variant="body"
            weight={500}
            tone={disabled ? "disabled" : "primary"}
            numberOfLines={1}
          >
            {recipient.name}
          </Text>
          <Text variant="monoBody" tone={disabled ? "disabled" : "secondary"} numberOfLines={1}>
            {`@${recipient.username}`}
          </Text>
        </View>
        {disabled ? (
          <Badge tone="neutral" variant="outline">
            {verificationLabel}
          </Badge>
        ) : selected ? (
          <Icon icon={CheckCircle} size="sm" tone="active" weight="fill" />
        ) : null}
      </PressableScale>
      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="px-6 pb-1 pt-4">
      <Text variant="label" tone="secondary">
        {children}
      </Text>
    </View>
  )
}

function RowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 px-6 py-3">
      <Skeleton shape="circle" width={40} height={40} />
      <View className="flex-1 gap-2">
        <Skeleton height={14} className="w-2/5" />
        <Skeleton height={12} className="w-1/4" />
      </View>
    </View>
  )
}

export function TransferRecipientPicker({
  query,
  onQueryChange,
  results = [],
  recent = [],
  loading = false,
  value,
  onSelect,
  labels,
  className,
  ...rest
}: TransferRecipientPickerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const searching = query.trim().length > 0
  const list = searching ? results : recent

  return (
    <View className={cn("w-full", className)} {...rest}>
      <View className="px-6">
        <SearchField
          value={query}
          onChangeText={onQueryChange}
          onClear={() => onQueryChange("")}
          placeholder={t.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View className="pt-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : searching && list.length === 0 ? (
        <EmptyState icon={UserCircle} title={t.emptyTitle} description={t.emptyBody} compact />
      ) : list.length > 0 ? (
        <View>
          <SectionLabel>{searching ? t.results : t.recent}</SectionLabel>
          {list.map((r, i) => (
            <RecipientRow
              key={r.id}
              recipient={r}
              selected={r.id === value}
              divider={i < list.length - 1}
              onSelect={onSelect}
              t={t}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}
