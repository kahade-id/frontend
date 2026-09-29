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
import { useCallback, useMemo, useState } from "react"
import {
  FlatList,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type ViewProps,
} from "react-native"

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
import { focusRingInset } from "@/lib/focus-ring"
import { translate } from "@/lib/i18n/translate"

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

/**
 * Baris sheet dinormalisasi jadi data FlatList agar direktori bank yang
 * panjang tervirtualisasi (sebelumnya ScrollView + .map me-render ratusan
 * baris berlogo dalam satu frame).
 */
type SheetRow =
  | { kind: "section"; key: string; label: string }
  | { kind: "bank"; key: string; bank: BankOption }

/** h-14 — tinggi baris BankRow tetap */
const BANK_ROW_HEIGHT = 56
/** pt-3(12) + label lineHeight(18) + pb-2(8) — SectionLabel */
const SECTION_LABEL_HEIGHT = 38

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

  const select = useCallback(
    (code: string) => {
      onChange(code)
      setOpen(false)
    },
    [onChange],
  )

  const sheetRows = useMemo<SheetRow[]>(() => {
    const rows: SheetRow[] = []
    if (popular.length > 0) {
      rows.push({ kind: "section", key: "section-popular", label: t.popular })
      for (const b of popular) rows.push({ kind: "bank", key: `p-${b.code}`, bank: b })
      rows.push({ kind: "section", key: "section-all", label: t.all })
    }
    for (const b of filtered) rows.push({ kind: "bank", key: b.code, bank: b })
    return rows
  }, [popular, filtered, t.popular, t.all])

  const renderSheetRow = useCallback(
    ({ item }: ListRenderItemInfo<SheetRow>) => {
      if (item.kind === "section") return <SectionLabel>{item.label}</SectionLabel>
      const b = item.bank
      return <BankRow bank={b} selected={b.code === value} onPress={() => select(b.code)} />
    },
    [value, select],
  )

  const sheetKeyExtractor = useCallback((item: SheetRow) => item.key, [])

  const sheetGetItemLayout = useCallback(
    (data: ArrayLike<SheetRow> | null | undefined, index: number) => {
      // Offset kumulatif dari tinggi baris tetap (bank 56px, section 38px).
      let offset = 0
      for (let i = 0; i < index; i++) {
        const it = data?.[i]
        offset += it?.kind === "section" ? SECTION_LABEL_HEIGHT : BANK_ROW_HEIGHT
      }
      const item = data?.[index]
      const length = item?.kind === "section" ? SECTION_LABEL_HEIGHT : BANK_ROW_HEIGHT
      return { length, offset, index }
    },
    [],
  )

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
        padding="none"
      >
        <View className="px-5 pb-3">
          <SearchField value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} autoFocus />
        </View>

        {/* Tinggi maks 60% window: nilai runtime -> style, bukan className */}
        <FlatList
          style={{ maxHeight: height * 0.6 }}
          keyboardShouldPersistTaps="handled"
          data={sheetRows}
          keyExtractor={sheetKeyExtractor}
          renderItem={renderSheetRow}
          getItemLayout={sheetGetItemLayout}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            <EmptyState icon={Bank} title={t.emptyTitle} description={t.emptyDescription} compact />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </BottomSheet>
    </>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="px-5 pb-2 pt-3">
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={bank.name}
      accessibilityState={{ selected, disabled: !!bank.disabled }}
      scaleOnPress={false}
      disabled={bank.disabled}
      onPress={onPress}
      containerClassName={cn("w-full", focusRingInset, bank.disabled && "opacity-disabled")}
      {...rest}
    >
      <View className={cn("h-14 w-full flex-row items-center gap-3 px-5", selected && "bg-surface", className)}>
        <BankLogo bank={bank} />
        <Text ellipsizeMode="tail" variant="body" weight={500} className="flex-1" numberOfLines={1}>
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
  // `bg-white` SENGAJA bukan token: logo bank diterbitkan di atas putih dan
  // banyak yang transparan, jadi di dark mode pun ubinnya harus tetap putih
  // agar logonya terbaca. Ini satu-satunya warna hardcode di app/ +
  // components/ — jangan "dirapikan" jadi bg-background.
  
  return (
    <View className="overflow-hidden rounded-xs border border-border bg-white" style={{ width: size, height: size }}>
      <Picture source={bank.logo} alt={translate("Logo {x}", { x: bank.name })} width={size} height={size} resizeMode="contain" radius="none" />
    </View>
  )
}