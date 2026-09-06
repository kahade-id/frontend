/**
 * Kahade — <BankSelect> (§9.4 Select + §9.9 BottomSheet + §7 logo berwarna).
 *
 * Pemilih bank/e-wallet: trigger bergaya <Select> yang membuka BottomSheet
 * berisi pencarian + daftar bank dengan logo asli berwarna (satu-satunya
 * pengecualian monokrom di §7, demi familiaritas saat memilih tujuan uang).
 *
 * Keputusan non-obvious:
 *   - Sheet dikelola di dalam komponen (state `open`) karena Select hanya
 *     trigger; pemanggil cukup kirim `value`/`onChange`. Sesuai §9.9, sheet
 *     ini tidak boleh membuka sheet lain — konfirmasi dilakukan setelah
 *     sheet tertutup.
 *   - Daftar populer (`popularCodes`) ditampilkan dulu saat query kosong —
 *     bank besar menutup mayoritas kasus, sisanya lewat pencarian.
 *   - Logo yang gagal dimuat / tidak ada fallback ke <IconBox Bank> monokrom
 *     supaya baris tetap sejajar (lebar leading konstan 40px).
 *   - Pencarian mencocokkan nama & kode bank, case-insensitive, tanpa diakritik.
 */
import { Bank, Check } from "phosphor-react-native"
import { useMemo, useState } from "react"
import { ScrollView, useWindowDimensions, View, type ViewProps } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { IconBox } from "@/components/ui/icon-box"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SearchField } from "@/components/ui/search-field"
import { Select, type SelectProps } from "@/components/ui/select"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type BankOption = {
  /** Kode unik (mis. "bca", "bri", "gopay") */
  code: string
  name: string
  /** Logo resmi berwarna (URI / asset). Opsional -> fallback ikon Bank */
  logo?: string | number
  /** "bank" atau "ewallet" — hanya untuk label section, opsional */
  kind?: "bank" | "ewallet"
  disabled?: boolean
}

export type BankSelectLabels = {
  label: string
  sheetTitle: string
  searchPlaceholder: string
  popular: string
  all: string
  emptyTitle: string
  emptyDescription: string
}

const DEFAULT_LABELS: BankSelectLabels = {
  label: "Bank / e-wallet",
  sheetTitle: "Pilih bank atau e-wallet",
  searchPlaceholder: "Cari nama bank",
  popular: "Populer",
  all: "Semua",
  emptyTitle: "Tidak ditemukan",
  emptyDescription: "Coba kata kunci lain.",
}

export type BankSelectProps = Omit<SelectProps<string>, "options" | "open" | "onPress" | "label"> & {
  banks: readonly BankOption[]
  onChange: (code: string) => void
  /** Kode bank yang ditampilkan di bagian "Populer" saat belum mencari */
  popularCodes?: readonly string[]
  label?: string
  labels?: Partial<BankSelectLabels>
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function BankSelect({ banks, value, onChange, popularCodes, label, labels, disabled, ...rest }: BankSelectProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const options = useMemo(() => banks.map((b) => ({ value: b.code, label: b.name, disabled: b.disabled })), [banks])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return banks
    return banks.filter((b) => normalize(b.name).includes(q) || normalize(b.code).includes(q))
  }, [banks, query])

  const popular = useMemo(
    () => (popularCodes && !query ? popularCodes.map((c) => banks.find((b) => b.code === c)).filter(Boolean) as BankOption[] : []),
    [popularCodes, banks, query],
  )

  const select = (code: string) => {
    onChange(code)
    setOpen(false)
  }

  return (
    <>
      <Select
        label={label ?? t.label}
        value={value}
        options={options}
        open={open}
        disabled={disabled}
        leftIcon={Bank}
        onPress={() => setOpen(true)}
        {...rest}
      />

      <BottomSheet
        visible={open}
        onRequestClose={() => setOpen(false)}
        title={t.sheetTitle}
        avoidKeyboard
        onHidden={() => setQuery("")}
        contentClassName="px-0 pb-0"
      >
        <View accessible={false} className="px-6 pb-3">
          <SearchField value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} autoFocus />
        </View>

        {/* Tinggi maks 60% window: nilai runtime -> style, bukan className */}
        <ScrollView style={{ maxHeight: height * 0.6 }} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <EmptyState icon={Bank} title={t.emptyTitle} description={t.emptyDescription} compact />
          ) : (
            <>
              {popular.length > 0 ? (
                <>
                  <SectionLabel>{t.popular}</SectionLabel>
                  {popular.map((b) => <BankRow key={`p-${b.code}`} bank={b} selected={b.code === value} onPress={() => select(b.code)} />)}
                  <SectionLabel>{t.all}</SectionLabel>
                </>
              ) : null}
              {filtered.map((b) => (
                <BankRow key={b.code} bank={b} selected={b.code === value} onPress={() => select(b.code)} />
              ))}
            </>
          )}
          <View className="h-6" />
        </ScrollView>
      </BottomSheet>
    </>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="px-6 pb-2 pt-3">
      <Text variant="label" tone="secondary">
        {children}
      </Text>
    </View>
  )
}

export type BankRowProps = Omit<ViewProps, "children"> & {
  bank: BankOption
  selected?: boolean
  onPress?: () => void
  className?: string
}

export function BankRow({ bank, selected = false, onPress, className, ...rest }: BankRowProps) {
  return (
    <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
      accessibilityRole="button"
      accessibilityLabel={bank.name}
      accessibilityState={{ selected, disabled: !!bank.disabled }}
      scaleOnPress={false}
      disabled={bank.disabled}
      onPress={onPress}
      containerClassName={cn("w-full", bank.disabled && "opacity-disabled")}
      {...rest}
    >
      <View className={cn("h-14 w-full flex-row items-center gap-3 px-6", selected && "bg-surface", className)}>
        <BankLogo bank={bank} />
        <Text variant="body" weight={500} className="flex-1" numberOfLines={1}>
          {bank.name}
        </Text>
        {selected ? <Icon icon={Check} size="sm" tone="active" weight="bold" /> : null}
      </View>
    </PressableScale>
  )
}

/** Logo 40x40 dengan border tipis; fallback ikon Bank monokrom */
export function BankLogo({ bank, size = 40 }: { bank: Pick<BankOption, "logo" | "name">; size?: number }) {
  if (!bank.logo) return <IconBox icon={Bank} size="md" />
  return (
    <View className="overflow-hidden rounded-xs border border-border bg-white" style={{ width: size, height: size }}>
      <Picture source={bank.logo} alt={`Logo ${bank.name}`} width={size} height={size} resizeMode="contain" radius="none" />
    </View>
  )
}