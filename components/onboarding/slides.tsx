/**
 * Kahade — konten slide onboarding (screen #1 alur auth).
 *
 * Tiga slide, masing-masing = satu "artefak produk" + judul Display + body.
 * Artefak dibangun dari primitif UI yang sama dengan app sesungguhnya
 * (Card, Amount, OrderStatusBadge, Timeline, IconText) — bukan ilustrasi
 * gambar — supaya calon user melihat *persis* apa yang akan mereka pakai:
 * nominal Mono, badge status, garis waktu escrow. Ini "satu titik kejutan"
 * (§1.6) layar ini; sisanya tenang.
 *
 * Keputusan non-obvious:
 *   - Judul memakai <DisplayHeading> (EB Garamond 34/42) — satu dari sedikit
 *     tempat yang diizinkan §1.4/§3.1 ("hero heading onboarding").
 *   - Copy formal "Anda" (§12). Disusun sebagai array key-based di satu
 *     tempat (bukan hardcode di JSX) agar i18n-ready tanpa refactor.
 *   - Data artefak adalah CONTOH statis (bukan fetch): nominal, ID, dan
 *     status hanya ilustrasi alur; tidak ada tanggal supaya tidak perlu
 *     memilih antara format lengkap §13 (terlalu panjang untuk kartu) dan
 *     format singkat (melanggar §13).
 *   - Kartu artefak diberi `accessibilityLabel` ringkas (audit #4): tanpa
 *     itu screen reader membaca 6–8 fragmen (nominal, badge, label, nilai)
 *     sebelum sampai ke judul slide. Kartu tidak punya tombol, jadi root
 *     boleh `accessible` (bukan <CardSummary>).
 *   - Slide 3 memakai IconText, bukan BulletList: poin keamanan butuh ikon
 *     Phosphor spesifik (KYC / PIN / mediasi), tetap text-tertiary (§7).
 */
import type { ReactNode } from "react"
import { View } from "react-native"
import { IdentificationCard, LockKey, Scales } from "phosphor-react-native"

import { Amount, MonoText } from "@/components/ui/amount"
import { Card } from "@/components/ui/card"
import { DisplayHeading } from "@/components/ui/heading"
import { IconText } from "@/components/ui/icon-text"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { Text } from "@/components/ui/text"
import { Timeline } from "@/components/ui/timeline"
import { VStack } from "@/components/ui/stack"
import { summarize } from "@/lib/a11y"

export type OnboardingSlide = {
  key: string
  title: string
  body: string
  artifact: ReactNode
}

// ------------------------------------------------------------------
// Artefak — contoh statis dari komponen produk nyata
// ------------------------------------------------------------------

const SAMPLE_AMOUNT = 2_500_000
const SAMPLE_ORDER_ID = "KHD-240903-0812"

function EscrowCard() {
  return (
    <Card
      variant="elevated"
      accessibilityLabel={summarize([
        `Contoh transaksi ${SAMPLE_ORDER_ID}`,
        "Rp2.500.000",
        "Dana di escrow",
        "Pembeli andi.p, Penjual toko.rani",
      ])}
    >
      <VStack gap={4}>
        <View className="flex-row items-center justify-between gap-3">
          <MonoText tone="secondary">{SAMPLE_ORDER_ID}</MonoText>
          <OrderStatusBadge status="PAID" />
        </View>
        <VStack gap={1}>
          <Text variant="caption" tone="secondary">
            Dana ditahan Kahade
          </Text>
          <Amount value={SAMPLE_AMOUNT} size="large" />
        </VStack>
        <KeyValueList>
          <KeyValue label="Pembeli" value="@andi.p" />
          <KeyValue label="Penjual" value="@toko.rani" />
        </KeyValueList>
      </VStack>
    </Card>
  )
}

function FlowCard() {
  return (
    <Card
      variant="elevated"
      accessibilityLabel={summarize([
        "Contoh alur escrow",
        "Pembeli membayar, selesai",
        "Penjual mengirim, selesai",
        "Barang diterima, sedang berjalan",
        "Dana dilepas ke penjual, belum dimulai",
      ])}
    >
      <Timeline
        items={[
          // Tanpa timestamp: §13 mewajibkan format lengkap "3 Sep 2026, 09:12"
          // yang terlalu panjang untuk kartu ilustrasi; jam saja melanggar aturan.
          { id: "pay", title: "Pembeli membayar", status: "done" },
          { id: "ship", title: "Penjual mengirim", status: "done" },
          { id: "receive", title: "Barang diterima", status: "current" },
          { id: "release", title: "Dana dilepas ke penjual", status: "upcoming" },
        ]}
      />
    </Card>
  )
}

function ProtectionCard() {
  return (
    <Card
      variant="elevated"
      accessibilityLabel={summarize([
        "Lapisan perlindungan",
        "Identitas terverifikasi (KYC)",
        "PIN dan biometrik di setiap transaksi",
        "Mediasi sengketa oleh tim Kahade",
      ])}
    >
      <VStack gap={4}>
        <IconText icon={IdentificationCard} variant="bodyLarge" tone="primary" alignTop>
          Identitas kedua pihak terverifikasi (KYC)
        </IconText>
        <IconText icon={LockKey} variant="bodyLarge" tone="primary" alignTop>
          PIN dan biometrik di setiap transaksi
        </IconText>
        <IconText icon={Scales} variant="bodyLarge" tone="primary" alignTop>
          Mediasi sengketa oleh tim Kahade
        </IconText>
      </VStack>
    </Card>
  )
}

// ------------------------------------------------------------------
// Copy — key-based, i18n-ready (§12)
// ------------------------------------------------------------------

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: "guarantee",
    title: "Bukan sekadar transfer — ini jaminan.",
    body: "Dana pembeli ditahan Kahade, bukan langsung ke penjual. Kedua pihak terlindungi sejak rupiah pertama.",
    artifact: <EscrowCard />,
  },
  {
    key: "release",
    title: "Dana dilepas hanya setelah barang sampai.",
    body: "Penjual mengirim, Anda mengonfirmasi. Baru setelah itu dana diteruskan — setiap langkah tercatat.",
    artifact: <FlowCard />,
  },
  {
    key: "protection",
    title: "Ada masalah? Kami berdiri di tengah.",
    body: "Identitas terverifikasi, PIN di setiap transaksi, dan tim mediasi bila terjadi sengketa.",
    artifact: <ProtectionCard />,
  },
]

// ------------------------------------------------------------------
// Render satu slide
// ------------------------------------------------------------------

export type OnboardingSlideViewProps = {
  slide: OnboardingSlide
  /** Lebar kolom pager — diukur runtime oleh carousel (bukan token) */
  width: number
}

export function OnboardingSlideView({ slide, width }: OnboardingSlideViewProps) {
  return (
    // Lebar = lebar viewport pager, nilai runtime -> style, bukan className.
    <View style={{ width }} className="flex-1 px-6">
      {/* Artefak: ambil sisa ruang, konten di tengah secara vertikal */}
      <View className="flex-1 justify-center py-6">{slide.artifact}</View>

      <VStack gap={3} className="pb-8">
        <DisplayHeading>{slide.title}</DisplayHeading>
        <Text variant="bodyLarge" tone="secondary" className="text-pretty">
          {slide.body}
        </Text>
      </VStack>
    </View>
  )
}
