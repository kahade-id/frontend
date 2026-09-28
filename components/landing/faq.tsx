/**
 * Kahade landing — <LandingFaq>: tanya jawab dalam accordion.
 *
 * Satu item terbuka dalam satu waktu. Ikon Plus berputar 45° (menjadi ×)
 * saat item terbuka; tanpa animasi berat. Jawaban di-render kondisional
 * (tidak ada animasi tinggi), dan transisi putar dimatikan saat
 * prefers-reduced-motion.
 */
import { useState } from "react"
import { Pressable, View } from "react-native"
import { Plus } from "phosphor-react-native"

import { cn } from "@/lib/cn"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

type FaqItem = {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: "Apa itu escrow Kahade?",
    answer:
      "Escrow adalah rekening penampung netral milik Kahade. Uang pembeli ditahan di sana selama transaksi berjalan, lalu dicairkan ke penjual setelah pembeli mengonfirmasi barang atau jasa sudah diterima. Penjual tidak memegang uang sebelum mengirim, pembeli tidak kehilangan uang sebelum menerima.",
  },
  {
    question: "Berapa biayanya?",
    answer:
      "Biaya layanan dihitung transparan per transaksi dan selalu ditampilkan sebelum Anda membayar — tidak ada biaya tersembunyi. Besaran pastinya mengikuti jenis dan nilai transaksi, dan tercantum jelas di ringkasan pembayaran.",
  },
  {
    question: "Bagaimana kalau barang tidak dikirim?",
    answer:
      "Dana Anda tetap aman di escrow selama penjual belum mengirim. Jika melewati batas waktu pengiriman, Anda bisa membatalkan transaksi atau membuka sengketa — dana kembali ke dompet Anda setelah peninjauan.",
  },
  {
    question: "Bagaimana penyelesaian sengketa?",
    answer:
      "Buka sengketa dari halaman transaksi, sampaikan kronologi beserta bukti (foto, chat, resi). Tim Kahade menengahi kedua pihak lewat ruang sengketa khusus, lalu memutuskan secara adil: dana diteruskan ke penjual atau dikembalikan ke pembeli.",
  },
  {
    question: "Apakah data saya aman?",
    answer:
      "Ya. Data pribadi dan transaksi terenkripsi, nomor HP dan identitas terverifikasi tidak dibagikan ke lawan transaksi melebihi yang diperlukan, dan akses internal dibatasi serta diaudit. Lihat Kebijakan Privasi kami untuk detail lengkapnya.",
  },
  {
    question: "Bagaimana cara menarik dana ke rekening?",
    answer:
      "Buka menu Dompet, pilih Tarik Dana, masukkan nominal dan pilih rekening bank yang sudah Anda daftarkan, lalu konfirmasi dengan PIN dompet. Dana diproses ke rekening Anda sesuai jadwal penarikan.",
  },
  {
    question: "Apakah harus install aplikasi?",
    answer:
      "Tidak wajib. Kamu bisa langsung membuka web app Kahade dari browser HP atau laptop dan memakai semua fitur utama. Aplikasi tersedia bila kamu ingin pengalaman yang lebih cepat dengan notifikasi real-time.",
  },
  {
    question: "Bagaimana cara mulai jualan di Kahade?",
    answer:
      "Daftar dengan nomor HP (verifikasi via WhatsApp), lengkapi profil, lalu buat etalase pertamamu: foto produk, harga, dan deskripsi. Etalase bisa langsung dibagikan ke media sosial — pembeli yang tertarik akan membuat pesanan escrow denganmu.",
  },
]

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const reducedMotion = useReducedMotion()

  return (
    <Section id="faq" eyebrow="FAQ" title="Masih penasaran?">
      <View className="mx-auto w-full max-w-3xl">
        <Reveal>
          <View className="overflow-hidden rounded-md border border-border bg-surface">
            {FAQS.map((item, index) => {
              const open = openIndex === index
              return (
                <View key={item.question} className={cn(index > 0 && "border-t border-border")}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={item.question}
                    onPress={() => setOpenIndex(open ? null : index)}
                    className="w-full flex-row items-center gap-4 px-5 py-4"
                  >
                    <Text variant="body" weight={600} className="flex-1">
                      {item.question}
                    </Text>
                    <View
                      // Putar halus di web; instan bila reduced motion.
                      className={cn(!reducedMotion && "transition-transform duration-200")}
                      style={{ transform: [{ rotate: open ? "45deg" : "0deg" }] }}
                    >
                      <Icon icon={Plus} size="sm" tone="active" />
                    </View>
                  </Pressable>
                  {open ? (
                    <View className="px-5 pb-5">
                      <Text variant="body" tone="secondary">
                        {item.answer}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        </Reveal>
      </View>
    </Section>
  )
}
