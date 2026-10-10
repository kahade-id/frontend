/** Social OAuth entry point and the follow-up branches shared by login/social. */
import { useCallback, useState } from "react"
import { useRouter } from "expo-router"

import {
  SocialLoginButtons,
  type SocialOutcome,
} from "@/components/auth/social-login-buttons"
import { Dialog } from "@/components/ui/modal"
import { useLoginNavigation } from "@/components/auth/use-login-navigation"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { setPendingMigrationToken } from "@/lib/phone-migration-token"
import { setPendingSocialLinkConfirm } from "@/lib/social-link-confirm"
import { setPendingSocialSignup } from "@/lib/social-signup"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import type { SocialProvider } from "@/lib/api/social"

type Props = {
  nextPath?: string
  /**
   * Mulai OAuth provider ini segera setelah kapabilitas server terbaca —
   * dipakai deep link lama `/login?method=google|apple` supaya tautan itu
   * tetap menjalankan alurnya, bukan hanya mendarat di hub.
   */
  autoStartProvider?: SocialProvider
}

/**
 * Tombol sosial + percabangan hasilnya (sesi / 2FA / migrasi nomor / tautan
 * akun). Pemisah "atau" BUKAN tanggung jawab komponen ini: di hub Masuk
 * pemisah itu memisahkan grup aksi besar dari daftar metode, jadi posisinya
 * milik layar (app/(auth)/login.tsx).
 */
export function LoginSocialSection({ nextPath, autoStartProvider }: Props) {
  const router = useRouter()
  const { beginLogin, finishLogin } = useLoginNavigation(nextPath)
  const [pendingLinkToken, setPendingLinkToken] = useState<string | null>(null)
  const [linkConfirmOpen, setLinkConfirmOpen] = useState(false)

  const handleOutcome = useCallback(
    (outcome: SocialOutcome) => {
      if (outcome.kind === "session") {
        void finishLogin()
        return
      }
      if (outcome.kind === "twoFactor") {
        setPendingTwoFactorLogin({ tempToken: outcome.tempToken, identifier: "", origin: "social" })
        router.push(ROUTES.verify2fa)
        return
      }
      if (outcome.kind === "phoneMigration") {
        setPendingMigrationToken(outcome.migrationToken)
        router.replace(ROUTES.phoneMigration())
        return
      }
      if (outcome.kind === "linkRequired") {
        setPendingLinkToken(outcome.linkToken)
        setLinkConfirmOpen(true)
        return
      }

      setPendingSocialLinkConfirm({
        linkToken: outcome.linkToken,
        maskedEmail: outcome.maskedEmail,
        provider: outcome.provider,
      })
      // #FE-I9 (pasangan): email tersamar TIDAK lagi lewat route param — ia
      // sudah ada di holder memori; di web param itu masuk history/Referer.
      router.push(ROUTES.socialLinkConfirm({ provider: outcome.provider }))
    },
    [finishLogin, router],
  )

  const clearLinkConfirmation = useCallback(() => {
    setLinkConfirmOpen(false)
    setPendingLinkToken(null)
  }, [])

  return (
    <>
      <SocialLoginButtons
        onBeforeStart={beginLogin}
        onOutcome={handleOutcome}
        autoStartProvider={autoStartProvider}
      />
      <Dialog
        title={translate("Akun belum terdaftar")}
        description={translate(
          "Daftar dulu dengan nomor HP — akun ditautkan otomatis setelah terverifikasi.",
        )}
        visible={linkConfirmOpen}
        confirmLabel={translate("Lanjutkan daftar")}
        cancelLabel={translate("Batal")}
        onConfirm={() => {
          setLinkConfirmOpen(false)
          if (pendingLinkToken) setPendingSocialSignup(pendingLinkToken)
          setPendingLinkToken(null)
          router.push(ROUTES.register)
        }}
        onCancel={clearLinkConfirmation}
        onRequestClose={clearLinkConfirmation}
      />
    </>
  )
}
