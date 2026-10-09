/**
 * Kahade — <LegalConsent> satu baris persetujuan (overhaul auth 2026-10-10).
 *
 * Menggantikan paragraf disclaimer panjang yang dulu menumpuk di kaki layar
 * masuk/daftar ("Demi keamanan, lokasi perangkat dapat dicatat…", langkah
 * WhatsApp, dsb). Aturan produk: SATU baris kecil abu-abu berisi persetujuan
 * dengan tautan ke dokumennya — bukan paragraf. Detail teknis pindah ke
 * <AuthSecurityInfo> (ikon ⓘ) dan Pusat Bantuan.
 *
 * Keputusan non-obvious:
 *   - Kalimat dirakit dari FRAGMEN yang masing-masing lewat `translate()`.
 *     <Text> hanya menerjemahkan otomatis bila seluruh children-nya string;
 *     begitu ada <TextLink> di tengah kalimat, children menjadi campuran dan
 *     auto-translate mati (pola yang sama dengan UI-M014 di change-phone).
 *     Karena itu `useLanguage()` dilanggankan di sini agar baris ini ikut
 *     berganti bahasa tanpa reload, dan tiap fragmen punya kunci katalognya
 *     sendiri — bukan satu kalimat panjang dengan slot {x} yang memaksa
 *     penerjemah menyusun ulang tautannya.
 *   - `action` memilih fragmen pembuka ("masuk" / "membuat akun" /
 *     "melanjutkan") supaya layar daftar tidak mengklaim persetujuan masuk.
 *   - Tautan memakai router.push ke rute dokumen in-app (ROUTES.terms /
 *     ROUTES.privacyPolicy) — dokumen legal dirender di dalam aplikasi dan
 *     tersedia offline (components/legal-document-screen.tsx), jadi tidak
 *     pernah membuka browser di tengah alur masuk.
 *   - Tanpa titik di akhir: ini baris persetujuan, bukan kalimat naratif.
 */
import { View } from "react-native"
import { useRouter } from "expo-router"

import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"

export type LegalConsentAction = "signIn" | "signUp" | "continue"

/**
 * Fragmen pembuka per aksi. Kunci i18n = teks Indonesia apa adanya
 * (kontrak lib/i18n/translate.ts), jadi tiap varian punya terjemahan sendiri.
 */
const LEAD: Record<LegalConsentAction, string> = {
  signIn: "Dengan masuk, Anda menyetujui",
  signUp: "Dengan membuat akun, Anda menyetujui",
  continue: "Dengan melanjutkan, Anda menyetujui",
}

export type LegalConsentProps = {
  action?: LegalConsentAction
  /** Slot kanan baris (biasanya <AuthSecurityInfo />). */
  trailing?: React.ReactNode
  className?: string
}

export function LegalConsent({ action = "signIn", trailing, className }: LegalConsentProps) {
  // Children campuran (teks + tautan) tidak diterjemahkan otomatis oleh <Text>.
  useLanguage()
  const router = useRouter()

  return (
    <View className={cn("flex-row items-start gap-1", className)}>
      <Text variant="caption" tone="secondary" className="min-w-0 flex-1 text-center text-pretty">
        {translate(LEAD[action])}{" "}
        <TextLink
          inline
          variant="caption"
          weight={500}
          onPress={() => router.push(ROUTES.terms)}
        >
          {translate("Syarat & Ketentuan")}
        </TextLink>{" "}
        {translate("serta")}{" "}
        <TextLink
          inline
          variant="caption"
          weight={500}
          onPress={() => router.push(ROUTES.privacyPolicy)}
        >
          {translate("Kebijakan Privasi")}
        </TextLink>
      </Text>
      {trailing}
    </View>
  )
}
