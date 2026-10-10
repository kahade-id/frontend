/**
 * Kahade — <LoginMethodList> tiga metode masuk, satu metode = satu halaman.
 *
 * Bagian bawah hub Masuk (setelah pemisah "atau"). Setiap baris MEMBUKA
 * HALAMAN SENDIRI (`/login/whatsapp`, `/login/email`, `/login/username`) —
 * arsitektur lama menumpuk ketiga form di satu rute dengan SegmentedControl,
 * sehingga layar berubah tinggi/pendek tiap kali metode diganti dan state
 * (captcha, error, draft identifier) ikut berpindah antar metode.
 *
 * Keputusan non-obvious:
 *   - Baris dirender sebagai <ListItem href>, bukan tombol: perpindahannya
 *     adalah navigasi layar, dan di web `href` memberi elemen <a> sungguhan
 *     (bisa cmd-klik / buka di tab baru) — alasan yang sama dengan audit a11y
 *     web pada menu Keamanan.
 *   - `next` diteruskan ke halaman metode lewat query (path saja, bukan
 *     kredensial) supaya tujuan semula tidak hilang setelah OTP/2FA.
 *   - Subtitle menyebut KREDENSIAL yang akan diminta ("kode verifikasi sekali
 *     pakai" / "email dan kata sandi"): pengguna harus tahu apa yang diminta
 *     SEBELUM masuk ke halaman, bukan sesudah.
 *   - WhatsApp memakai ikon brand (WhatsappLogo) karena kanal itu yang
 *     dikenali pengguna; Email/Username memakai ikon generik agar tidak
 *     menyiratkan penyedia tertentu.
 */
import { View } from "react-native"
import { Envelope, User, WhatsappLogo } from "phosphor-react-native"
import type { Href } from "expo-router"

import { ListItem } from "@/components/ui/list-item"
import { ROUTES } from "@/lib/routes"
import type { IconComponent } from "@/components/ui/icon"

export type LoginMethodKey = "whatsapp" | "email" | "username"

export type LoginMethodEntry = {
  key: LoginMethodKey
  title: string
  subtitle: string
  icon: IconComponent
  href: (next?: string) => Href
}

/**
 * Urutan tampil = urutan prioritas produk: WhatsApp paling sering dipakai
 * (registrasi pun hanya lewat nomor HP), lalu email, lalu username.
 */
export const LOGIN_METHODS: readonly LoginMethodEntry[] = [
  {
    key: "whatsapp",
    title: "WhatsApp",
    subtitle: "Kode verifikasi sekali pakai",
    icon: WhatsappLogo,
    href: (next) => ROUTES.loginWhatsapp(next),
  },
  {
    key: "email",
    title: "Email",
    subtitle: "Email dan kata sandi",
    icon: Envelope,
    href: (next) => ROUTES.loginEmail(next),
  },
  {
    key: "username",
    title: "Username",
    subtitle: "Username dan kata sandi",
    icon: User,
    href: (next) => ROUTES.loginUsername(next),
  },
]

export type LoginMethodListProps = {
  nextPath?: string
}

export function LoginMethodList({ nextPath }: LoginMethodListProps) {
  return (
    // Label kontainer sengaja TIDAK dipasang: grup ini berisi baris yang
      // bisa difokuskan, dan RN mengabaikan `accessibilityLabel` pada
      // kontainer semacam itu (audit a11y #4). Tiap baris sudah membawa
      // judul + subtitle-nya sendiri.
    <View accessibilityRole="list" className="w-full overflow-hidden rounded-md bg-surface">
      {LOGIN_METHODS.map((method, index) => (
        <ListItem
          key={method.key}
          title={method.title}
          titleVariant="bodyLarge"
          subtitle={method.subtitle}
          leading={method.icon}
          chevron
          divider={index < LOGIN_METHODS.length - 1}
          href={method.href(nextPath)}
        />
      ))}
    </View>
  )
}
