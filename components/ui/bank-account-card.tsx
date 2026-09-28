/**
 * Kahade — <BankAccountCard> kartu rekening premium (redesign 2026-09-27, TIM BANK).
 *
 * Satu kartu per rekening di layar Rekening Bank, mengikuti bahasa visual
 * dompet baru: avatar bank (logo resmi berwarna dalam ubin bundar, atau
 * lingkaran berwarna dengan inisial bank bila logo tidak ada), nama bank +
 * badge "Utama", nomor termasker (`maskAccountNumber` — format yang sama
 * dengan daftar lain), nama pemilik, lalu baris aksi terpisah
 * (Jadikan utama / Edit nama / Hapus).
 *
 * PRESENTASI MURNI: semua aksi diteruskan lewat callback; logika API
 * (POST /{id}/set-primary, DELETE, PATCH nama) tetap milik layar.
 *
 * Keputusan non-obvious:
 *   - Logo bank = pengecualian monokrom §7 (satu-satunya logo berwarna,
 *     demi familiaritas saat memilih tujuan uang). Ubin BUNDAR 48px
 *     mengikuti pola kartu premium dompet, bukan ubin kotak <BankLogo>.
 *   - Tanpa logo → lingkaran berwarna + inisial putih. Warna deterministik
 *     dari kode bank (palet tetap 8 warna) — murni dekoratif, bukan status.
 *   - Badge "Utama" = <Badge tone="neutral" variant="outline">: rekening
 *     utama adalah kategori, bukan status semantik (§2.3) — sama dengan
 *     <BankAccountListItem>.
 *   - Nomor TERMASKER (default `maskAccountNumber`): daftar rekening sering
 *     terlihat orang lain saat user memilih tujuan tarik dana (§14); layar
 *     ini tidak punya gate PIN sehingga tidak ada mode reveal di sini.
 *   - Blok identitas dibungkus <CardSummary> (satu ringkasan untuk screen
 *     reader); tombol-tombol aksi adalah kontrol fokusable terpisah.
 *   - verified={false} → <StatusIndicator tone="warning"> "Belum
 *     diverifikasi" — ini status, boleh berwarna (sama dengan
 *     <BankAccountListItem>).
 */
import { CheckCircle, PencilSimpleLine, Trash } from "phosphor-react-native"
import { View } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary } from "@/components/ui/card"
import { Picture, type PictureProps } from "@/components/ui/picture"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { maskAccountNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

/** Palet avatar: dekoratif, stabil antar render (indeks dari hash kode). */
const AVATAR_COLORS = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-violet-700",
  "bg-amber-700",
  "bg-rose-700",
  "bg-cyan-700",
  "bg-indigo-700",
  "bg-orange-700",
] as const

function avatarColor(key: string): string {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export type BankAccountCardLabels = {
  primary: string
  unverified: string
  setPrimary: string
  editName: string
  delete: string
}

const DEFAULT_LABELS: BankAccountCardLabels = {
  primary: "Utama",
  unverified: "Belum diverifikasi",
  setPrimary: "Jadikan utama",
  editName: "Ubah nama",
  delete: "Hapus",
}

export type BankAccountCardProps = {
  bankName: string
  /** Kode bank (BCA, BNI, …) — untuk warna avatar & fallback teks */
  bankCode?: string
  accountNumber: string
  accountHolder: string
  /** Logo resmi bank (berwarna, §7 pengecualian) */
  logo?: PictureProps["source"]
  /** Rekening utama untuk penarikan */
  primary?: boolean
  /** Nama pemilik sudah divalidasi ke bank */
  verified?: boolean
  onSetPrimary?: () => void
  onEdit?: () => void
  onDelete?: () => void
  labels?: Partial<BankAccountCardLabels>
  className?: string
}

function BankAvatar({
  bankCode,
  bankName,
  logo,
}: Pick<BankAccountCardProps, "bankCode" | "bankName" | "logo">) {
  const initial = (bankName.trim()[0] ?? "B").toUpperCase()
  return (
    <View
      className={cn(
        "h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border",
        // Logo bank diterbitkan di atas putih & banyak yang transparan →
        // ubin putih (sama seperti <BankLogo>), bukan token permukaan.
        logo ? "bg-white" : avatarColor(bankCode ?? bankName),
      )}
    >
      {logo ? (
        <Picture
          source={logo}
          alt={translate("Logo {x}", { x: bankName })}
          width={32}
          height={32}
          resizeMode="contain"
          radius="none"
        />
      ) : (
        <Text variant="h3" weight={700} tone="inverse">
          {initial}
        </Text>
      )}
    </View>
  )
}

export function BankAccountCard({
  bankName,
  bankCode,
  accountNumber,
  accountHolder,
  logo,
  primary = false,
  verified = true,
  onSetPrimary,
  onEdit,
  onDelete,
  labels,
  className,
}: BankAccountCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  const summary = [
    bankName,
    `rekening berakhiran ${accountNumber.slice(-4)}`,
    accountHolder,
    primary ? t.primary : undefined,
    !verified ? t.unverified : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Card padded={false} className={cn("rounded-lg", className)}>
      <View className="p-5">
        <CardSummary label={summary} className="flex-row items-center gap-3">
          <BankAvatar bankCode={bankCode} bankName={bankName} logo={logo} />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text ellipsizeMode="tail" variant="body" weight={600} numberOfLines={1} className="flex-1">
                {bankCode ? `${bankName} · ${bankCode}` : bankName}
              </Text>
              {primary ? (
                <Badge tone="neutral" variant="outline">
                  {t.primary}
                </Badge>
              ) : null}
            </View>
            <Text ellipsizeMode="tail" variant="monoBody" tone="secondary" numberOfLines={1}>
              {maskAccountNumber(accountNumber)}
            </Text>
            <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1}>
              {accountHolder}
            </Text>
            {!verified ? <StatusIndicator label={t.unverified} tone="warning" size="sm" /> : null}
          </View>
        </CardSummary>

        <View className="mt-4 flex-row items-center gap-2 border-t border-border pt-3">
          {!primary && onSetPrimary ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              leftIcon={CheckCircle}
              onPress={onSetPrimary}
            >
              {t.setPrimary}
            </Button>
          ) : null}
          <View className="flex-1" />
          {onEdit ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              leftIcon={PencilSimpleLine}
              onPress={onEdit}
            >
              {t.editName}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              leftIcon={Trash}
              onPress={onDelete}
            >
              {t.delete}
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  )
}
