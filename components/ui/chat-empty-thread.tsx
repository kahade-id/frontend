/**
 * Kahade — <ChatEmptyThread> keadaan "belum ada pesan" di ruang chat
 * (audit chat G19): ILUSTRASI + panduan singkat, bukan sekadar ikon.
 *
 * Tiga potong teks, masing-masing satu tugas:
 *   1. judul    — keadaan ("Belum ada pesan");
 *   2. panduan  — apa yang dilakukan sekarang (sapa, tanyakan detail) + satu
 *                 pengingat keselamatan: transaksi lewat Kahade;
 *   3. petunjuk — cara mengirim selain teks (+ dan tahan mikrofon). Ini juga
 *                 satu-satunya tempat pengguna baru diberi tahu gestur tahan-
 *                 untuk-merekam.
 *
 * Ilustrasi = vektor (react-native-svg) berwarna token, dua gelembung (masuk
 * dan keluar) + tiga titik "mengetik" — bukan bitmap, jadi tajam di semua
 * kepadatan layar, ikut mode terang/gelap, dan tidak menambah ukuran bundel.
 * Dekoratif murni: disembunyikan dari pembaca layar.
 *
 * Tanpa istilah internal yang dilarang produk (escrow/rekber/ditahan/penahanan).
 */
import { View } from "react-native"
import Svg, { Circle, Rect } from "react-native-svg"

import { useTheme } from "@/components/theme-provider"
import { Text } from "@/components/ui/text"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"

export type ChatEmptyThreadProps = {
  /** Nama lawan bicara untuk sapaan; kosong → sapaan generik. */
  name?: string | null
  /** Pesan untuk diri sendiri — panduan berbeda (tidak ada lawan bicara). */
  selfChat?: boolean
}

export function ChatEmptyThread({ name, selfChat = false }: ChatEmptyThreadProps) {
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const peer = name?.trim()

  const guidance = selfChat
    ? translate("Simpan catatan, tautan, atau foto untuk diri sendiri di sini.")
    : peer
      ? translate(
          "Sapa {x} untuk memulai percakapan. Tanyakan detail barang atau jasa, dan lakukan transaksi lewat Kahade agar aman.",
          { x: peer },
        )
      : translate(
          "Sapa lawan bicara Anda untuk memulai percakapan. Tanyakan detail barang atau jasa, dan lakukan transaksi lewat Kahade agar aman.",
        )

  return (
    <View
      testID="chat-empty-thread"
      accessibilityRole="summary"
      className="w-full flex-1 items-center justify-center gap-4 px-8 py-12"
    >
      {/* Dekoratif: gelembung masuk (kiri, outline) + keluar (kanan, solid) + titik mengetik. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={168} height={120} viewBox="0 0 168 120">
          <Rect
            x={8}
            y={10}
            width={104}
            height={48}
            rx={16}
            fill={palette.surface}
            stroke={palette.borderDefault}
            strokeWidth={2}
          />
          <Rect x={24} y={26} width={56} height={6} rx={3} fill={palette.textTertiary} />
          <Rect x={24} y={40} width={36} height={6} rx={3} fill={palette.textTertiary} />
          <Rect x={56} y={64} width={104} height={44} rx={16} fill={palette.primary} />
          <Circle cx={92} cy={86} r={5} fill={palette.primaryForeground} />
          <Circle cx={108} cy={86} r={5} fill={palette.primaryForeground} opacity={0.7} />
          <Circle cx={124} cy={86} r={5} fill={palette.primaryForeground} opacity={0.4} />
        </Svg>
      </View>

      <View className="max-w-[320px] items-center gap-2">
        <Text variant="h3" accessibilityRole="header" className="text-center">
          {translate("Belum ada pesan")}
        </Text>
        <Text variant="body" tone="secondary" className="text-center">
          {guidance}
        </Text>
        <Text variant="caption" tone="secondary" className="text-center">
          {translate("Ketuk + untuk foto, berkas, atau lokasi. Tahan mikrofon untuk pesan suara.")}
        </Text>
      </View>
    </View>
  )
}
