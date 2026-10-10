/**
 * Kahade — layar "Cara kerja" Patungan & Jastip (U5-014, journey 2026-09-29).
 *
 * Satu komponen reusable dengan `mode`: langkah-langkah sesuai desain yang
 * DISETUJUI user + simulasi nominal yang konsisten dengan desain tersebut.
 * Angka pada simulasi murni contoh ilustratif ("bukan penawaran") — tidak
 * mengarang perilaku uang baru di luar desain yang disetujui.
 */
import { View } from "react-native"

import { formatRupiah } from "@/lib/format"

import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

export type HowItWorksMode = "patungan" | "jastip"

type SimRow = { label: string; value: string; bold?: boolean }

function Step({ n, children }: { n: number; children: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-soft">
        <Text variant="caption" weight={700} tone="accent">
          {String(n)}
        </Text>
      </View>
      <Text variant="body" className="flex-1 text-pretty">
        {children}
      </Text>
    </View>
  )
}

function SimTable({ rows }: { rows: SimRow[] }) {
  return (
    <View className="gap-1.5 rounded-md bg-surface p-3">
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-baseline justify-between gap-3">
          <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
            {row.label}
          </Text>
          <Text variant="caption" weight={row.bold ? 700 : 400} className="tabular-nums">
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const PATUNGAN_STEPS = [
  "Host membuat grup: tentukan target dana, iuran per orang, dan deadline.",
  "Semua peserta membayar iuran ke Kahade SEBELUM deadline — bukan ke host langsung.",
  "Fee layanan dibagi rata ke semua peserta dan tampil di depan sebelum membayar.",
  "Target tercapai → host mengajukan pencairan; ada masa sanggah 24 jam untuk peserta sebelum dana cair.",
  "Target tidak tercapai saat deadline → dana kembali OTOMATIS dan penuh ke semua peserta (termasuk fee).",
  "Kelebihan dana (overfunding) dibagi rata sebagai pengurang iuran per orang.",
  "Grup dibatalkan sebelum dana cair → refund otomatis. Setelah dana cair → sengketa normal.",
]

const JASTIP_STEPS = [
  "Host membuat etalase trip: tujuan, deadline pesanan, jumlah slot, dan katalog — request bebas juga bisa.",
  "Peserta mengajukan request barang; host mengonfirmasi dan MENGUNCI harga (harga barang + fee jastip + ongkir, terpisah).",
  "Buyer membayar total yang dikunci ke Kahade.",
  "Host berbelanja. Bila host gagal mendapatkan barang → dana kembali OTOMATIS ke buyer.",
  "Host mengirim barang; buyer konfirmasi terima → dana cair ke host.",
  "Buyer membatalkan SETELAH host membeli (ada struk) → diselesaikan lewat sengketa normal.",
  "Ulasan khusus jastip: ketepatan, kondisi barang, dan komunikasi.",
]

export function HowItWorksScreen({ mode }: { mode: HowItWorksMode }) {
  const isPatungan = mode === "patungan"
  const title = isPatungan ? "Cara kerja Patungan" : "Cara kerja Jastip"
  const steps = isPatungan ? PATUNGAN_STEPS : JASTIP_STEPS

  return (
    // UX-SPA-010: konten ~950pt (intro + 7 langkah + simulasi) — tanpa scroll
    // bagian bawah terpotong di layar kecil (mis. iPhone SE 667pt).
    <Screen edges={["top"]} padded={false} scroll>
      <Header title={title} />
      <View className="gap-6 px-5 pb-10 pt-4">
        <Text variant="body" tone="secondary" className="text-pretty">
          {isPatungan
            ? "Patungan mengumpulkan dana bersama lewat Kahade: dana hanya cair ke host bila target tercapai."
            : "Jastip menitipkan belanja ke host lewat Kahade: harga dikunci di depan, dana cair setelah barang diterima."}
        </Text>

        <View className="gap-4">
          {steps.map((step, i) => (
            <Step key={i} n={i + 1}>
              {step}
            </Step>
          ))}
        </View>

        <View className="gap-3">
          <Text variant="h3" weight={700}>
            Simulasi nominal
          </Text>
          {isPatungan ? (
            <View className="gap-3">
              <Text variant="caption" tone="secondary" className="text-pretty">
                Grup &ldquo;Kado perpisahan&rdquo; — target {formatRupiah(1000000)}, 10 peserta.
              </Text>
              <SimTable
                rows={[
                  { label: "Iuran pokok per orang", value: formatRupiah(100000) },
                  { label: "Fee layanan per orang (dibagi rata, tampil di depan)", value: formatRupiah(2000) },
                  { label: "Dibayar tiap peserta", value: formatRupiah(102000), bold: true },
                  { label: "Terkumpul (10 orang)", value: formatRupiah(1020000) },
                  { label: "Cair ke host (setelah masa sanggah 24 jam)", value: formatRupiah(1000000), bold: true },
                ]}
              />
              <Text variant="caption" tone="secondary" className="text-pretty">
                Bila hanya 8 orang membayar saat deadline: target gagal →{" "}
                {formatRupiah(816000)} kembali otomatis dan penuh ke 8 peserta.
              </Text>
              <Text variant="caption" tone="secondary" className="text-pretty">
                Bila 12 orang sempat membayar ({formatRupiah(1224000)}): kelebihan{" "}
                {formatRupiah(204000)} dibagi rata → tiap orang hemat {formatRupiah(17000)}{" "}
                (efektif bayar {formatRupiah(85000)}).
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              <Text variant="caption" tone="secondary" className="text-pretty">
                Trip &ldquo;Jakarta – Bandung&rdquo; — deadline 3 hari, 20 slot.
              </Text>
              <SimTable
                rows={[
                  { label: "Harga barang (dikunci host)", value: formatRupiah(850000) },
                  { label: "Fee jastip", value: formatRupiah(50000) },
                  { label: "Ongkir", value: formatRupiah(25000) },
                  { label: "Dibayar buyer ke Kahade", value: formatRupiah(925000), bold: true },
                  { label: "Cair ke host (setelah buyer konfirmasi)", value: formatRupiah(925000), bold: true },
                ]}
              />
              <Text variant="caption" tone="secondary" className="text-pretty">
                Host tidak mendapatkan barang → {formatRupiah(925000)} kembali otomatis ke buyer.
                Buyer batal setelah host membeli (ada struk) → diselesaikan lewat sengketa.
              </Text>
            </View>
          )}
          <Text variant="caption" tone="tertiary" className="text-pretty">
            Angka di atas hanya contoh ilustrasi, bukan penawaran.
          </Text>
        </View>
      </View>
    </Screen>
  )
}
