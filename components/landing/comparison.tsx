/**
 * Kahade landing — <LandingComparison>: tabel perbandingan Kahade vs
 * marketplace biasa vs rekber manual.
 *
 * Mobile: ScrollView horizontal agar kolom tidak gepeng. Kolom Kahade
 * di-highlight (bg-surface-elevated + border).
 */
import { ScrollView, View } from "react-native"
import { Check, Minus, X } from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

type CellStatus = "good" | "neutral" | "bad"

const STATUS_ICON: Record<CellStatus, { icon: IconComponent; tone: "success" | "default" | "danger" }> = {
  good: { icon: Check, tone: "success" },
  neutral: { icon: Minus, tone: "default" },
  bad: { icon: X, tone: "danger" },
}

const HEADERS = ["Kahade", "Marketplace biasa", "Rekber manual"] as const

const ROWS: { label: string; cells: { text: string; status: CellStatus }[] }[] = [
  {
    label: "Keamanan dana",
    cells: [
      { text: "Escrow otomatis", status: "good" },
      { text: "Tergantung platform", status: "neutral" },
      { text: "Tergantung kejujuran admin", status: "bad" },
    ],
  },
  {
    label: "Interaksi sosial",
    cells: [
      { text: "Like, komen & share etalase", status: "good" },
      { text: "Katalog kaku", status: "neutral" },
      { text: "Chat manual", status: "neutral" },
    ],
  },
  {
    label: "Penyelesaian sengketa",
    cells: [
      { text: "Admin bantu sampai tuntas", status: "good" },
      { text: "CS lambat", status: "neutral" },
      { text: "Tidak ada", status: "bad" },
    ],
  },
  {
    label: "Transparansi biaya",
    cells: [
      { text: "Ditampilkan jelas di awal", status: "good" },
      { text: "Kadang tersembunyi", status: "neutral" },
      { text: "Fee admin tak pasti", status: "bad" },
    ],
  },
  {
    label: "Verifikasi pengguna",
    cells: [
      { text: "KYC penjual & pembeli", status: "good" },
      { text: "Sebagian terverifikasi", status: "neutral" },
      { text: "Tidak ada verifikasi", status: "bad" },
    ],
  },
  {
    label: "Kecepatan",
    cells: [
      { text: "Instan di app", status: "good" },
      { text: "—", status: "neutral" },
      { text: "Lama & manual", status: "bad" },
    ],
  },
]

function CompareCell({
  text,
  status,
  highlighted,
}: {
  text: string
  status: CellStatus
  highlighted?: boolean
}) {
  const { icon, tone } = STATUS_ICON[status]
  return (
    <View
      className={
        highlighted
          ? "flex-1 items-center justify-center rounded-lg border border-border bg-surface-elevated p-4"
          : "flex-1 items-center justify-center p-4"
      }
    >
      <Icon icon={icon} size="md" tone={tone} />
      <Text variant="caption" tone="secondary" className="mt-2 text-center">
        {text}
      </Text>
    </View>
  )
}

export function LandingComparison() {
  return (
    <Section
      id="perbandingan"
      eyebrow="Perbandingan"
      title="Kenapa Kahade, bukan yang lain?"
      description="Transaksi aman ala escrow, tapi tetap seru seperti media sosial."
    >
      <Reveal>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="w-full min-w-[680px] gap-2">
            {/* Header */}
            <View className="flex-row gap-2">
              <View className="flex-[1.2] p-4" />
              {HEADERS.map((header, i) => (
                <View
                  key={header}
                  className={
                    i === 0
                      ? "flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated p-4"
                      : "flex-1 items-center justify-center p-4"
                  }
                >
                  {i === 0 ? (
                    <View className="rounded-full bg-primary px-3 py-1">
                      <Text variant="caption" tone="inverse" weight={700}>
                        Pilihan aman
                      </Text>
                    </View>
                  ) : null}
                  <Text variant="label" className="text-center">
                    {header}
                  </Text>
                </View>
              ))}
            </View>
            {/* Baris data — zebra agar mudah dipindai baris per baris */}
            {ROWS.map((row, rowIndex) => (
              <View
                key={row.label}
                className={
                  rowIndex % 2 === 1
                    ? "flex-row gap-2 rounded-lg bg-surface"
                    : "flex-row gap-2"
                }
              >
                <View className="flex-[1.2] justify-center p-4">
                  <Text variant="label">{row.label}</Text>
                </View>
                {row.cells.map((cell, i) => (
                  <CompareCell
                    key={cell.text}
                    text={cell.text}
                    status={cell.status}
                    highlighted={i === 0}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </Reveal>
    </Section>
  )
}
