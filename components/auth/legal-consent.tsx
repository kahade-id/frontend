/**
 * Kahade — <LegalConsent> satu baris persetujuan (overhaul auth 2026-10-10).
 *
 * Menggantikan paragraf disclaimer panjang yang dulu menumpuk di kaki layar
 * masuk/daftar (lokasi perangkat, langkah WhatsApp, dsb). Aturan produk: SATU
 * baris kecil abu-abu berisi persetujuan dengan tautan ke dokumennya — bukan
 * paragraf. Detail teknis pindah ke <AuthSecurityInfo> (ikon ⓘ) dan Pusat
 * Bantuan.
 *
 * Keputusan non-obvious:
 *   - Kalimat diterjemahkan SATU KESATUAN bertoken bernama ({terms},
 *     {privacy}), lalu slot-nya diisi ulang sebagai <TextLink> di sini.
 *     Pola fragmen ("Dengan masuk, Anda menyetujui" + tautan + "serta" +
 *     tautan) TIDAK bisa dipakai: <Text> hanya menerjemahkan otomatis bila
 *     SELURUH children-nya string murni (lib/i18n/translate.ts
 *     `localizeChildren`), dan generator katalog membuang literal satu kata
 *     huruf kecil (`isTechnical` di scripts/gen-i18n-catalog.mjs) sehingga
 *     konektor "serta"/"dan" tidak akan pernah punya terjemahan — pengguna
 *     English akan melihat kalimat campur dua bahasa. Dengan satu kunci
 *     bertoken, penerjemah bebas menyusun ulang urutan kata + artikelnya
 *     ("you agree to the {terms} and the {privacy}").
 *   - `action` memilih kalimatnya (masuk / membuat akun / melanjutkan) supaya
 *     layar daftar tidak mengklaim persetujuan "masuk". Tiap varian ditulis
 *     sebagai literal di dalam `translate()` agar terkatalog (E-03/E-06).
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
 * Penanda slot sementara. Nilai ini hanya hidup di dalam string hasil
 * `translate()` dan langsung dipecah kembali menjadi node React — tidak
 * pernah dirender, jadi karakternya bebas selama unik.
 *
 * Nama tokennya `{x}`/`{y}`, bukan `{terms}`/`{privacy}`: check-i18n
 * memaksa urutan kanonik x, y, z, w supaya satu kalimat tidak melahirkan
 * beberapa kunci kamus antar layar.
 */
const TERMS_SLOT = "@@terms@@"
const PRIVACY_SLOT = "@@privacy@@"

function consentSentence(action: LegalConsentAction): string {
  const vars = { x: TERMS_SLOT, y: PRIVACY_SLOT }
  if (action === "signUp") {
    return translate("Dengan membuat akun, Anda menyetujui {x} serta {y}", vars)
  }
  if (action === "continue") {
    return translate("Dengan melanjutkan, Anda menyetujui {x} serta {y}", vars)
  }
  return translate("Dengan masuk, Anda menyetujui {x} serta {y}", vars)
}

export type LegalConsentProps = {
  action?: LegalConsentAction
  /** Slot kanan baris (biasanya <AuthSecurityInfo />). */
  trailing?: React.ReactNode
  className?: string
}

export function LegalConsent({ action = "signIn", trailing, className }: LegalConsentProps) {
  // Children campuran (teks + tautan) tidak diterjemahkan otomatis oleh <Text>,
  // jadi tiap potongan di sini lewat translate() eksplisit dan komponen harus
  // ikut berganti bahasa tanpa reload.
  useLanguage()
  const router = useRouter()

  const sentence = consentSentence(action)
  // Terjemahan yang menjatuhkan salah satu slot tetap dirender aman: bagian
  // yang hilang menjadi string kosong, bukan "undefined" di layar.
  const [lead = "", afterTerms = ""] = sentence.split(TERMS_SLOT)
  const [middle = "", tail = ""] = afterTerms.split(PRIVACY_SLOT)

  return (
    <View className={cn("flex-row items-start gap-1", className)}>
      <Text variant="caption" tone="secondary" className="min-w-0 flex-1 text-center text-pretty">
        {lead}
        <TextLink
          inline
          variant="caption"
          weight={500}
          onPress={() => router.push(ROUTES.terms)}
        >
          {translate("Syarat & Ketentuan")}
        </TextLink>
        {middle}
        <TextLink
          inline
          variant="caption"
          weight={500}
          onPress={() => router.push(ROUTES.privacyPolicy)}
        >
          {translate("Kebijakan Privasi")}
        </TextLink>
        {tail}
      </Text>
      {trailing}
    </View>
  )
}
