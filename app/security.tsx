/**
 * Hub Keamanan — menu lokal menuju alur keamanan akun.
 *
 * Halaman ini hanya berisi navigasi dan informasi tetap. Status email/nomor,
 * 2FA, PIN, langganan notifikasi, atau saldo tidak di-fetch di sini: halaman
 * menu selalu tampil langsung saat offline. Aksi keluar dipisahkan ke kontrol
 * eksplisit di footer; perubahan akun dijalankan pada layar tujuan.
 */
import { ScrollView, View } from "react-native"
import {
  Bell,
  DeviceMobile,
  Fingerprint,
  Key,
  LockKey,
  Mailbox,
  Phone,
  ShieldCheck,
  Trash,
  UserFocus,
  UserMinus,
} from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"

import { Header } from "@/components/ui/header"
import { ListItem } from "@/components/ui/list-item"
import { MenuGroupLabel } from "@/components/ui/section"
import { Screen } from "@/components/ui/screen"
import { SecurityLogoutControl } from "@/components/security/security-logout-control"

export default function SecurityScreen() {
  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={<SecurityLogoutControl />}
    >
      <Header title="Keamanan" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-5 pb-8 pt-4"
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
              trailing="Google / Apple"
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

        <View className="gap-2">
          <MenuGroupLabel>Notifikasi</MenuGroupLabel>
          <View className="w-full overflow-hidden rounded-md bg-surface">
            <ListItem
              title="Preferensi Notifikasi"
              titleVariant="bodyLarge"
              leading={Bell}
              chevron
              href={ROUTES.notificationPreferences}
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
      </ScrollView>
    </Screen>
  )
}
