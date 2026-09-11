/**
 * Kahade — Dukungan Langsung (live chat ke admin Kahade).
 *
 * Berbeda dari tab Chat (percakapan antar pengguna), layar ini adalah kanal
 * RESMI pengguna ↔ admin Kahade. Endpoint backend live-support belum tersedia,
 * sehingga layar ini sudah berjalan penuh sebagai klien:
 *   - UI pesan + composer memakai komponen chat yang sama dengan chat biasa;
 *   - selama endpoint belum ada, agen otomatis (triage) membalas berbasis
 *     kata kunci dan mengarahkan ke langkah yang benar;
 *   - percakapan sesi ini hidup di perangkat (tidak ada klaim pesan terkirim
 *     ke server) — saat endpoint `/v1/support/live` tersedia, hanya lapisan
 *     transport yang diganti, komponen ini tetap.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Lifebuoy } from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"
import { formatTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ChatComposer, type ChatComposerPayload } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Chip } from "@/components/ui/chip"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

type Message = {
  id: string
  fromSelf: boolean
  text: string
  at: Date
  status?: "sending" | "sent" | "delivered" | "read"
}

let seq = 0
const nextId = () => `ls-${Date.now()}-${seq++}`

const GREETING: Message = {
  id: "greeting",
  fromSelf: false,
  text:
    "Halo, selamat datang di Dukungan Langsung Kahade. Saya admin Kahade. " +
    "Ceritakan kendala yang Anda alami — pilih topik di bawah atau ketik langsung.",
  at: new Date(),
}

const QUICK_TOPICS: { label: string; text: string }[] = [
  { label: "Isi saldo", text: "Saya butuh bantuan isi saldo/top-up" },
  { label: "Transfer", text: "Saya butuh bantuan transfer saldo" },
  { label: "Tarik dana", text: "Saya butuh bantuan tarik dana" },
  { label: "Transaksi", text: "Transaksi escrow saya bermasalah" },
  { label: "Sengketa", text: "Saya ingin menanyakan sengketa" },
  { label: "Akun", text: "Saya tidak bisa masuk ke akun" },
]

type Rule = { keywords: string[]; reply: string | string[] }

const RULES: Rule[] = [
  {
    keywords: ["top", "isi saldo", "topup", "va", "virtual account", "qris", "bayar"],
    reply: [
      "Untuk isi saldo: buka tab Dompet → Isi Saldo, masukkan nominal, lalu pilih metode pembayaran (Virtual Account, e-wallet, atau QRIS).",
      "Ikuti instruksi pembayaran yang muncul; saldo masuk otomatis setelah pembayaran terkonfirmasi. Bila sudah membayar tetapi saldo belum masuk lebih dari 15 menit, kirimkan nomor transaksinya ke sini atau buat tiket bantuan agar kami telusuri.",
    ],
  },
  {
    keywords: ["transfer", "kirim", "terkirim", "penerima", "saldo berkurang"],
    reply:
      "Transfer antar pengguna butuh PIN dompet. Pastikan username penerima benar dan saldo Anda cukup. Bila status tertunda, periksa Riwayat di tab Dompet; transaksi gagal akan mengembalikan saldo otomatis.",
  },
  {
    keywords: ["tarik", "withdraw", "penarikan", "rekening", "bank"],
    reply:
      "Tarik dana: tab Dompet → Tarik, masukkan nominal dan pilih rekening tujuan (rekening harus atas nama Anda). Pencairan diproses sesuai jam operasional bank. Bila melebihi 1×24 jam kerja, siapkan nomor referensi penarikan.",
  },
  {
    keywords: ["escrow", "pesanan", "transaksi", "terima barang", "konfirmasi", "seller", "pembeli", "penjual"],
    reply:
      "Pada transaksi escrow, dana ditahan Kahade sampai pembeli mengonfirmasi barang diterupa atau tenggat berlalu. Jika barang bermasalah, gunakan tombol 'Ajukan Sengketa' di detail transaksi agar tim kami menjadi penengah.",
  },
  {
    keywords: ["sengketa", "dispute", "bukti", "mediasi"],
    reply:
      "Sengketa ditinjau berdasarkan bukti dari kedua pihak: foto/video barang, resi, dan riwayat chat. Lengkapi bukti di halaman sengketa. Tim kami biasanya memberikan keputusan dalam 1–3 hari kerja.",
  },
  {
    keywords: ["masuk", "login", "akun", "password", "kata sandi", "pin", "kunci", "2fa", "otp"],
    reply: [
      "Jika tidak bisa masuk: gunakan 'Lupa kata sandi?' di layar masuk untuk tautan reset via email/OTP. Untuk PIN dompet yang terlupa, buka Keamanan → Ganti PIN setelah verifikasi sandi.",
      "Bila nomor/email sudah tidak aktif, buat tiket bantuan dengan foto identitas dan username Anda untuk pemulihan akun.",
    ],
  },
  {
    keywords: ["halo", "hi", "hello", "pagi", "siang", "sore", "malam", "assalamu"],
    reply: "Halo! Ada yang bisa kami bantu terkait Kahade hari ini?",
  },
]

const FALLBACK =
  "Terima kasih informasinya. Mohon tunggu, admin Kahade akan menindaklanjuti. " +
  "Untuk kendala yang butuh lampiran atau penanganan resmi, sebaiknya buat tiket " +
  "bantuan lewat ikon tiket di pojok atas — riwayatnya tersimpan di akun Anda."

function autoReply(input: string): string[] {
  const lower = input.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return Array.isArray(rule.reply) ? rule.reply : [rule.reply]
    }
  }
  return [FALLBACK]
}

export default function LiveSupportScreen() {
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [draft, setDraft] = useState("")
  const [typing, setTyping] = useState(false)
  const listRef = useRef<ScrollView | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const scrollToEnd = useCallback((delay = 120) => {
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true })
    }, delay)
    timers.current.push(t)
  }, [])

  useEffect(() => {
    scrollToEnd()
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [messages, typing, scrollToEnd])

  const receiveFromAdmin = useCallback((replies: string[]) => {
    const t1 = setTimeout(() => setTyping(true), 500)
    timers.current.push(t1)
    replies.forEach((text, index) => {
      const t = setTimeout(
        () => {
          setTyping(index === replies.length - 1 ? false : true)
          setMessages((prev) => [
            ...prev,
            { id: nextId(), fromSelf: false, text, at: new Date() },
          ])
        },
        1100 + index * 1400,
      )
      timers.current.push(t)
    })
    // Pengaman: pastikan indikator mengetik hilang.
    const tEnd = setTimeout(
      () => setTyping(false),
      1300 + replies.length * 1400,
    )
    timers.current.push(tEnd)
  }, [])

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim()
      if (!clean) return
      const mine: Message = {
        id: nextId(),
        fromSelf: true,
        text: clean,
        at: new Date(),
        status: "sent",
      }
      setMessages((prev) => [...prev, mine])
      receiveFromAdmin(autoReply(clean))
      scrollToEnd()
    },
    [receiveFromAdmin, scrollToEnd],
  )

  const handleSend = useCallback(
    (payload: ChatComposerPayload) => {
      sendText(payload.content)
      setDraft("")
    },
    [sendText],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Dukungan Langsung"
        right={
          <RouteLink
            href={ROUTES.contact}
            accessibilityLabel="Buat tiket bantuan"
            containerClassName="rounded-xs"
            className="h-12 w-12 items-center justify-center rounded-xs"
          >
            <Icon icon={Lifebuoy} size={24} tone="active" />
          </RouteLink>
        }
      />

      {/* Status kanal resmi */}
      <View className="flex-row items-center justify-center gap-2 border-b border-border bg-surface py-2">
        <View className="h-2 w-2 rounded-full bg-success" />
        <Text variant="caption" tone="secondary">
          Admin Kahade · waktu respons biasanya beberapa menit
        </Text>
      </View>

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT} className="flex-1">
        <ScrollView
          ref={listRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 py-4"
          contentContainerStyle={{
            gap: tokens.space[2],
            paddingBottom: tokens.space[4],
          }}
        >
          <Text variant="caption" tone="secondary" className="text-center">
            Percakapan ini dengan admin resmi Kahade. Jangan membagikan kata
            sandi, PIN, atau OTP kepada siapa pun.
          </Text>

          {messages.map((message, index) => {
            const prev = messages[index - 1]
            const grouped = prev ? prev.fromSelf === message.fromSelf : false
            return (
              <ChatMessageBubble
                key={message.id}
                direction={message.fromSelf ? "outgoing" : "incoming"}
                text={message.text}
                time={formatTime(message.at)}
                status={message.fromSelf ? message.status : undefined}
                grouped={grouped}
                senderName={message.fromSelf ? undefined : "Admin Kahade"}
              />
            )
          })}

          {typing ? (
            <ChatMessageBubble direction="incoming" text="Admin sedang mengetik…" grouped />
          ) : null}
        </ScrollView>

        {/* Topik cepat — satu baris di atas composer */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 px-4 py-2"
        >
          {QUICK_TOPICS.map((topic) => (
            <Chip key={topic.label} onPress={() => sendText(topic.text)}>
              {topic.label}
            </Chip>
          ))}
        </ScrollView>

        <View style={{ paddingBottom: Math.max(0, insets.bottom - tokens.space[2]) }}>
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            onSend={handleSend}
            labels={{ placeholder: "Tulis pesan ke admin…", send: "Kirim" }}
          />
        </View>
      </KeyboardAvoiding>
    </Screen>
  )
}
