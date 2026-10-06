/** Social OAuth entry point and the follow-up branches shared by login/social. */
import { useCallback, useState } from "react"
import { useRouter } from "expo-router"

import {
  SocialLoginButtons,
  type SocialOutcome,
} from "@/components/auth/social-login-buttons"
import { Dialog } from "@/components/ui/modal"
import { useLoginNavigation } from "@/components/auth/use-login-navigation"
import { ROUTES } from "@/lib/routes"
import { setPendingMigrationToken } from "@/lib/phone-migration-token"
import { setPendingSocialLinkConfirm } from "@/lib/social-link-confirm"
import { setPendingSocialSignup } from "@/lib/social-signup"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import type { SocialProvider } from "@/lib/api/social"

type Props = {
  nextPath?: string
  autoStartProvider?: SocialProvider
  showDivider?: boolean
}

export function LoginSocialSection({ nextPath, autoStartProvider, showDivider = false }: Props) {
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
        setPendingTwoFactorLogin({ tempToken: outcome.tempToken, identifier: "" })
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
      router.push(
        ROUTES.socialLinkConfirm({
          maskedEmail: outcome.maskedEmail,
          provider: outcome.provider,
        }),
      )
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
        separatorLabel={showDivider ? "atau" : undefined}
      />
      <Dialog
        title="Akun belum terdaftar"
        description="Daftar dulu dengan nomor HP — akun ditautkan otomatis setelah terverifikasi."
        visible={linkConfirmOpen}
        confirmLabel="Lanjutkan daftar"
        cancelLabel="Batal"
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
