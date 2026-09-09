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
 *   Biometrik            expo-local-authentication        → app/biometric-settings.tsx
 *   Verifikasi 2 Langkah GET  /v1/auth/2fa/status         → app/two-factor.tsx
 *   Perangkat & Log      GET  /v1/sessions, security-log  → app/security-activity.tsx
 *   Privasi              GET  /v1/settings/privacy        → app/privacy-settings.tsx
 *   Pengguna Diblokir    GET  /v1/settings/blocked-users  → app/blocked-users.tsx
 *   Hapus Akun           POST /v1/users/me/delete-request → app/delete-account.tsx
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
 */
import { View } from "react-native"
import {
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

import { api, type UserProfile } from "@/lib/api"
import type { TwoFactorStatus } from "@/lib/api/auth"
import { getBiometricCapability, type BiometricCapability } from "@/lib/biometrics"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { ListItem } from "@/components/ui/list-item"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { SectionHeader } from "@/components/ui/section"

const NO_BIOMETRIC: BiometricCapability = { available: false, kind: "none", label: "biometrik" }

type SecurityHub = {
  me: UserProfile
  twoFactor: TwoFactorStatus | null
  biometric: BiometricCapability
}

export default function SecurityScreen() {
  const query = useApiQuery<SecurityHub>("security-hub", async (signal) => {
    const [me, twoFactor, biometric] = await Promise.all([
      api.users.getMe(signal),
      api.auth.get2faStatus(signal).catch(() => null),
      getBiometricCapability().catch(() => NO_BIOMETRIC),
    ])
    return { me, twoFactor, biometric }
  })

  const me = query.data?.me
  const twoFactor = query.data?.twoFactor
  const biometric = query.data?.biometric ?? NO_BIOMETRIC

  const twoFactorLabel = twoFactor ? (twoFactor.enabled ? "Aktif" : "Nonaktif") : undefined
  const biometricLabel = biometric.available ? biometric.label : "Tidak tersedia"

  return (
    <DataScreen
      title="Keamanan"
      state={query}
      loadingMessage="Memuat pengaturan keamanan"
      errorTitle="Gagal memuat pengaturan keamanan"
    >
      {/* ── Kredensial masuk ───────────────────────────────── */}
      <SectionHeader title="Kredensial" />
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
          title="Ganti Password"
          titleVariant="bodyLarge"
          leading={Key}
          chevron
          href={ROUTES.changePassword}
        />
        <ListItem
          title="Ganti PIN"
          titleVariant="bodyLarge"
          leading={LockKey}
          chevron
          href={ROUTES.changePin}
        />
      </View>

      {/* ── Kunci perangkat ────────────────────────────────── */}
      <SectionHeader title="Kunci Perangkat" />
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
      </View>

      {/* ── Perangkat & data ───────────────────────────────── */}
      <SectionHeader title="Perangkat & Data" />
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

      {/* ── Zona berbahaya ─────────────────────────────────── */}
      <SectionHeader title="Zona Berbahaya" />
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
    </DataScreen>
  )
}
