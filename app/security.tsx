/**
 * Screen — Keamanan (pusat pengaturan keamanan akun).
 *
 * Isi layar ini adalah PINTU MASUK, bukan data: setiap baris menavigasi ke
 * layar yang memang sudah punya kontrak API-nya sendiri. Sebelumnya menu
 * Pengaturan → Keamanan langsung membuka daftar perangkat/log (`/security`),
 * sehingga cara mengganti nomor HP, email, password, PIN, dan biometrik
 * tidak bisa ditemukan dari satu tempat — layar itu kini hidup di
 * `/security-activity` dan menjadi salah satu baris di sini.
 *
 * Baris & endpoint di baliknya:
 *   Ganti Email          POST /v1/auth/correct-email      → app/change-email.tsx
 *   Ganti Nomor HP       PUT  /v1/users/me (phoneNumber)  → app/change-phone.tsx
 *   Ganti Password       POST /v1/auth/change-password    → app/change-password.tsx
 *   Ganti PIN            POST /v1/wallet/set-pin          → app/change-pin.tsx
 *   Login Sosial         GET  /v1/auth/social             → app/social-providers.tsx
 *                        (taut/lepas butuh re-auth; last-method guard di server)
 *   Biometrik            expo-local-authentication        → app/biometric-settings.tsx
 *   Verifikasi 2 Langkah GET  /v1/auth/2fa/status         → app/two-factor.tsx
 *   Perangkat & Log      GET  /v1/sessions, security-log  → app/security-activity.tsx
 *   Privasi              GET  /v1/settings/privacy        → app/privacy-settings.tsx
 *   Pengguna Diblokir    GET  /v1/settings/blocked-users  → app/blocked-users.tsx
 *   Hapus Akun           POST /v1/users/me/delete-request → app/delete-account.tsx
 *
 * Sidebar 2026-10-05 (/settings DIHAPUS — layar ini hub akun penggantinya):
 *   Notifikasi           section tersendiri → app/notification-preferences.tsx
 *                        (satu sumber kebenaran layar penuhnya; di sini hanya
 *                        pintu + ringkasan status)
 *   Keluar               tombol destruktif sticky + Dialog konfirmasi
 *                        (pindahan /settings: unregister push + clear session)
 *
 * Keputusan non-obvious:
 *   - Nilai di kanan baris (trailing) adalah STATUS NYATA, bukan teks hiasan:
 *     email/nomor HP sekarang (dimasker <SensitiveText toggleable={false}>
 *     agar tidak bocor di layar yang bisa dilihat orang lain), 2FA
 *     aktif/nonaktif dari GET /v1/auth/2fa/status, dan label biometrik dari
 *     perangkat ("Face ID", "sidik jari", atau "Tidak tersedia").
 *   - Ketiga sumber status dimuat SATU query (Promise.all) supaya
 *     pull-to-refresh menyegarkan semuanya bersama dan tidak ada tiga
 *     skeleton bergantian. `get2faStatus` di-`.catch(() => null)`: status 2FA
 *     sekunder — kegagalannya tidak boleh menyembunyikan menu ganti password.
 *   - Baris memakai `href` (bukan `onPress`) agar di web menjadi <a href>
 *     sungguhan: bisa ctrl/cmd-klik dan diumumkan sebagai "tautan" (§ audit S5).
 *   - Tanpa subtitle & tanpa border kartu (mengikuti keputusan desain menu
 *     Pengaturan): judul `bodyLarge` + latar `bg-surface` + `rounded-md`,
 *     tanpa pemisah antar baris.
 *   - Judul kelompok memakai <MenuGroupLabel> (label 13/600 secondary), BUKAN
 *     <SectionHeader> (h2 22/700). Permintaan produk: "judul sectionnya kecil
 *     saja seperti di pengaturan". Keduanya layar daftar pengaturan dengan
 *     anatomi identical — kartu `bg-surface` berisi baris `bodyLarge` — jadi
 *     hierarkinya pun harus identical: judul kelompok menamai kartu, bukan
 *     bersaing dengan judul baris di dalamnya. Komponennya dibagikan lewat
 *     components/ui/section.tsx supaya Pengaturan dan Keamanan tidak bisa
 *     menyimpang lagi secara diam-diam.
 */
import { useCallback, useState } from "react"
import { Platform, View } from "react-native"
import { router } from "expo-router"
import {
  Bell,
  DeviceMobile,
  Fingerprint,
  Key,
  LockKey,
  Mailbox,
  Phone,
  ShieldCheck,
  SignOut,
  Trash,
  UserFocus,
  UserMinus,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import type { TwoFactorStatus } from "@/lib/api/auth"
import type { NotificationPreferences } from "@/lib/api/notifications"
import { clearSession } from "@/lib/api/session"
import { getBiometricCapability, type BiometricCapability } from "@/lib/biometrics"
import { summarizeNotificationPreferences } from "@/lib/notification-effective"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { ListItem } from "@/components/ui/list-item"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { Text } from "@/components/ui/text"
import { MenuGroupLabel } from "@/components/ui/section"

const NO_BIOMETRIC: BiometricCapability = { available: false, kind: "none", label: "biometrik" }

type SecurityHub = {
  me: UserProfile
  twoFactor: TwoFactorStatus | null
  biometric: BiometricCapability
  hasPin: boolean | null
}

export default function SecurityScreen() {
  // Mode Tanpa Wallet Internal: status PIN dibaca dari endpoint dompet —
  // jangan operasikan API wallet saat flag mati. Baris "Buat/Ganti PIN"
  // tetap tampil (PIN dibutuhkan untuk penarikan saldo lama); statusnya
  // netral (null) di mode ini.
  const walletEnabled = useWalletEnabled()
  const query = useApiQuery<SecurityHub>(`security-hub:${walletEnabled ? "w" : "nw"}`, async (signal) => {
    const [me, twoFactor, biometric, wallet] = await Promise.all([
      api.users.getMe(signal),
      api.auth.get2faStatus(signal).catch((err) => {
        logWarn("security:2fa-status", err)
        return null
      }),
      getBiometricCapability().catch(() => NO_BIOMETRIC),
      (walletEnabled ? api.wallet.getWallet(signal) : Promise.resolve(null)).catch((err) => {
        logWarn("security:wallet-pin-status", err)
        return null
      }),
    ])
    return {
      me,
      twoFactor,
      biometric,
      hasPin: wallet && typeof wallet.hasPin === "boolean" ? wallet.hasPin : null,
    }
  })

  const me = query.data?.me
  const twoFactor = query.data?.twoFactor
  const biometric = query.data?.biometric ?? NO_BIOMETRIC
  const hasPin = query.data?.hasPin

  const twoFactorLabel = twoFactor ? (twoFactor.enabled ? "Aktif" : "Nonaktif") : undefined
  const biometricLabel = biometric.available ? biometric.label : "Tidak tersedia"

  // Sidebar 2026-10-05: section Notifikasi (pindahan /settings) — kunci query
  // SAMA dengan layar preferensi ("notification-preferences") sehingga status
  // dibaca dari cache bersama, bukan GET ganda. Belum dimuat/gagal → tanpa
  // trailing (bukan angka yang menyesatkan).
  const notifPrefsQuery = useApiQuery<NotificationPreferences>(
    "notification-preferences",
    (signal) => api.notifications.getNotificationPreferences(signal),
  )
  const notifTrailing =
    summarizeNotificationPreferences(notifPrefsQuery.data ?? null) ?? undefined

  // Sidebar 2026-10-05: Keluar (pindahan /settings — Dialog konfirmasi
  // destruktif + unregister push device + clear session).
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  // AUT-004: kegagalan tulis flag sessionSignedOut saat logout ditampilkan
  // ke user (bukan dicatat diam-diam) — di web, tanpanya cookie bisa
  // menghidupkan lagi sesi yang baru diakhiri.
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      // Web: lepas token FCM Web + hapus token-nya; native: lepas Expo token.
      // Keduanya no-op yang aman bila push tidak aktif — logout tetap jalan.
      const deviceApi = {
        registerDevice: (dto: Parameters<typeof api.notifications.registerDevice>[0]) =>
          api.notifications.registerDevice(dto),
        unregisterDevice: (deviceId: string) =>
          api.notifications.unregisterDevice(deviceId),
      }
      if (Platform.OS === "web")
        await unregisterWebPushDevice(deviceApi).catch((err) => logWarn("security:unregister-push", err))
      else await unregisterPushDevice(deviceApi).catch((err) => logWarn("security:unregister-push", err))
      try {
        // AUT-004: logout() melempar bila flag sessionSignedOut gagal
        // ditulis — tampilkan ke user, JANGAN diam-diam menganggap sukses.
        await api.auth.logout()
      } catch (err) {
        logWarn("security:logout", err)
        setLogoutOpen(false)
        setLogoutError(
          "Keluar tidak tuntas: penanda sesi perangkat gagal disimpan. Token sudah dihapus, tetapi sesi bisa aktif lagi otomatis — coba keluar sekali lagi.",
        )
        return
      } finally {
        await clearSession()
      }
      router.replace(ROUTES.login)
    } finally {
      setLoggingOut(false)
    }
  }, [])

  return (
    <>
    <DataScreen
      title="Keamanan"
      state={query}
      loadingMessage="Memuat pengaturan keamanan"
      errorTitle="Gagal memuat pengaturan keamanan"
      // Tombol Keluar sticky (pindahan /settings): selalu terjangkau walau
      // query hub gagal — keluar tidak boleh bergantung pada muat status.
      footer={
        <View className="gap-2">
          {logoutError ? (
            <Alert tone="danger" title="Keluar tidak tuntas" onDismiss={() => setLogoutError(null)}>
              {logoutError}
            </Alert>
          ) : null}
          <Button
            variant="destructive"
            size="md"
            leftIcon={SignOut}
            onPress={() => setLogoutOpen(true)}
          >
            Keluar
          </Button>
        </View>
      }
    >
      {/* ── Kredensial masuk ───────────────────────────────── */}
      <View className="gap-2">
        <MenuGroupLabel>Kredensial</MenuGroupLabel>
        <View className="w-full overflow-hidden rounded-md bg-surface">
          <ListItem
            title="Ganti Email"
            titleVariant="bodyLarge"
            leading={Mailbox}
            chevron
            href={ROUTES.changeEmail}
            trailing={
              me?.email ? (
                <SensitiveText
                  value={me.email}
                  mask="email"
                  mono={false}
                  variant="caption"
                  tone="secondary"
                  toggleable={false}
                />
              ) : undefined
            }
          />
          <ListItem
            title="Ganti Nomor HP"
            titleVariant="bodyLarge"
            leading={Phone}
            chevron
            href={ROUTES.changePhone}
            trailing={
              me?.phoneNumber ? (
                <SensitiveText
                  value={me.phoneNumber}
                  mask="phone"
                  mono={false}
                  variant="caption"
                  tone="secondary"
                  toggleable={false}
                />
              ) : undefined
            }
          />
          <ListItem
            title="Ganti Kata Sandi"
            titleVariant="bodyLarge"
            leading={Key}
            chevron
            href={ROUTES.changePassword}
          />
          <ListItem
            title={hasPin === false ? "Buat PIN" : "Ganti PIN"}
            titleVariant="bodyLarge"
            leading={LockKey}
            chevron
            href={ROUTES.changePin}
            trailing={
              hasPin === false ? (
                <Text variant="caption" tone="warning">
                  Belum dibuat
                </Text>
              ) : undefined
            }
          />
          {/* GAP-A (G013/G018/G019): kelola akun Google/Apple yang tertaut.
              Penautan & pelepasan butuh re-auth; server menolak bila ini
              satu-satunya metode masuk. */}
          <ListItem
            title="Login Sosial"
            titleVariant="bodyLarge"
            leading={UserFocus}
            chevron
            href={ROUTES.socialProviders}
            trailing={
              <Text variant="caption" tone="secondary">
                Google / Apple
              </Text>
            }
          />
        </View>

      </View>

      {/* ── Kunci perangkat ────────────────────────────────── */}
      <View className="gap-2">
        <MenuGroupLabel>Kunci Perangkat</MenuGroupLabel>
        <View className="w-full overflow-hidden rounded-md bg-surface">
          <ListItem
            title="Biometrik"
            titleVariant="bodyLarge"
            leading={Fingerprint}
            chevron
            href={ROUTES.biometricSettings}
            trailing={biometricLabel}
          />
          <ListItem
            title="Verifikasi 2 Langkah"
            titleVariant="bodyLarge"
            leading={ShieldCheck}
            chevron
            href={ROUTES.twoFactor}
            trailing={twoFactorLabel}
          />
          {/*
           * GAP-A (G034): Passkey = kredensial masuk WebAuthn terverifikasi
           * server. Terpisah dari "Biometrik" di atas yang hanya mengunci
           * aplikasi di HP ini (app-lock lokal, bukan metode masuk akun).
           */}
          <ListItem
            title="Passkey"
            titleVariant="bodyLarge"
            leading={Key}
            chevron
            href={ROUTES.passkeys}
            trailing={
              <Text variant="caption" tone="secondary">
                Tanpa kata sandi
              </Text>
            }
          />
        </View>

      </View>

      {/* ── Notifikasi (pindahan /settings) ────────────────────────
          Layar penuh preferensi (perangkat + server + digest + quiet hours)
          tetap satu-satunya editor — di sini hanya pintu + ringkasannya. */}
      <View className="gap-2">
        <MenuGroupLabel>Notifikasi</MenuGroupLabel>
        <View className="w-full overflow-hidden rounded-md bg-surface">
          <ListItem
            title="Preferensi Notifikasi"
            titleVariant="bodyLarge"
            leading={Bell}
            chevron
            href={ROUTES.notificationPreferences}
            trailing={notifTrailing}
          />
        </View>
      </View>

      {/* ── Perangkat & data ───────────────────────────────── */}
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

      {/* ── Zona berbahaya ─────────────────────────────────── */}
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
    </DataScreen>

    {/* ── Dialog Konfirmasi Logout (pindahan /settings) ──────────
        FE-IMP-3 #93: tampilkan akun yang akan keluar supaya tidak salah
        akun (perangkat bersama / multi-akun). */}
    <Dialog
      visible={logoutOpen}
      tone="danger"
      destructive
      icon={SignOut}
      title="Keluar dari Kahade?"
      description={
        me?.username
          ? `Keluar dari akun @${me.username} di perangkat ini?`
          : "Keluar dari Kahade di perangkat ini?"
      }
      confirmLabel="Keluar"
      cancelLabel="Batal"
      loading={loggingOut}
      onConfirm={() => void performLogout()}
      onCancel={() => setLogoutOpen(false)}
      onRequestClose={() => setLogoutOpen(false)}
    />
    </>
  )
}
