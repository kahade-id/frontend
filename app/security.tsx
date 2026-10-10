/**
 * Hub Keamanan — menu lokal menuju alur keamanan akun.
 *
 * Halaman ini hanya berisi navigasi dan informasi tetap. Status email/nomor,
 * 2FA, PIN, langganan notifikasi, atau saldo tidak di-fetch di sini: halaman
 * menu selalu tampil langsung saat offline. Aksi keluar dipisahkan ke kontrol
 * eksplisit di footer; perubahan akun dijalankan pada layar tujuan.
 */
import { Platform, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  Bell,
  DeviceMobile,
  Fingerprint,
  Key,
  LockKey,
  Mailbox,
  PaintBrush,
  Phone,
  ShieldCheck,
  Trash,
  UserFocus,
  UserMinus,
} from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { ListItem } from "@/components/ui/list-item"
import { MenuGroupLabel } from "@/components/ui/section"
import { Screen } from "@/components/ui/screen"
import { SecurityLogoutControl } from "@/components/security/security-logout-control"

export default function SecurityScreen() {
  const insets = useSafeAreaInsets()

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Keamanan" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <View className="gap-2">
          <MenuGroupLabel>Kredensial</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Ganti Email"
              titleVariant="bodyLarge"
              leading={Mailbox}
              chevron
              href={ROUTES.changeEmail}
            />
            <ListItem
              title="Ganti Nomor HP"
              titleVariant="bodyLarge"
              leading={Phone}
              chevron
              href={ROUTES.changePhone}
            />
            <ListItem
              title="Ganti Kata Sandi"
              titleVariant="bodyLarge"
              leading={Key}
              chevron
              href={ROUTES.changePassword}
            />
            <ListItem
              title="PIN Dompet"
              titleVariant="bodyLarge"
              leading={LockKey}
              chevron
              href={ROUTES.changePin}
            />
            <ListItem
              title="Login Sosial"
              titleVariant="bodyLarge"
              leading={UserFocus}
              chevron
              href={ROUTES.socialProviders}
              // Audit 2026-10-10: Apple hanya tersedia di iOS (CLAUDE.md §5) —
              // Android/web sebelumnya menjanjikan "Apple" yang tidak ada.
              trailing={Platform.OS === "ios" ? "Google / Apple" : "Google"}
            />
          </View>
        </View>

        <View className="gap-2">
          <MenuGroupLabel>Kunci Perangkat</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Biometrik"
              titleVariant="bodyLarge"
              leading={Fingerprint}
              chevron
              href={ROUTES.biometricSettings}
            />
            <ListItem
              title="Verifikasi 2 Langkah"
              titleVariant="bodyLarge"
              leading={ShieldCheck}
              chevron
              href={ROUTES.twoFactor}
            />
            <ListItem
              title="Passkey"
              titleVariant="bodyLarge"
              leading={Key}
              chevron
              href={ROUTES.passkeys}
              trailing="Tanpa kata sandi"
            />
          </View>
        </View>

        {/* Audit Pengaturan 2026-10-10: "Tampilan" (/appearance — ikuti
            sistem, hemat data, ukuran teks) tidak punya pintu masuk sejak
            /settings dihapus; toggle drawer hanya memaksa terang/gelap dan
            tidak pernah bisa kembali ke "ikuti sistem". */}
        <View className="gap-2">
          <MenuGroupLabel>Preferensi</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Preferensi Notifikasi"
              titleVariant="bodyLarge"
              leading={Bell}
              chevron
              href={ROUTES.notificationPreferences}
            />
            <ListItem
              title="Tampilan"
              titleVariant="bodyLarge"
              leading={PaintBrush}
              chevron
              href={ROUTES.appearance}
            />
          </View>
        </View>

        <View className="gap-2">
          <MenuGroupLabel>Perangkat & Data</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Perangkat & Log"
              titleVariant="bodyLarge"
              leading={DeviceMobile}
              chevron
              href={ROUTES.securityActivity}
            />
            <ListItem
              title="Pengaturan Privasi"
              titleVariant="bodyLarge"
              leading={UserFocus}
              chevron
              href={ROUTES.privacySettings}
            />
            <ListItem
              title="Pengguna Diblokir"
              titleVariant="bodyLarge"
              leading={UserMinus}
              chevron
              href={ROUTES.blockedUsers}
            />
          </View>
        </View>

        <View className="gap-2">
          <MenuGroupLabel>Zona Berbahaya</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Hapus Akun"
              titleVariant="bodyLarge"
              leading={Trash}
              chevron
              destructive
              href={ROUTES.deleteAccount}
            />
          </View>
        </View>

        {/* P3 (overhaul auth 2026-10-10): "Keluar" mengikuti konten di ujung
            daftar, bukan FooterBar berpemisah `border-t`. Urutannya sengaja
            setelah "Zona Berbahaya" — keluar bukan bagian dari hapus akun,
            tapi tetap aksi terakhir yang dibaca pengguna. */}
        <SecurityLogoutControl />
      </ScrollView>
    </Screen>
  )
}
