/**
 * SocialLoginButtons — tombol "Masuk dengan Google / Apple" (GAP-A G001–G025).
 *
 * Desain:
 *  - Daftar provider diambil dari server (GET /v1/auth/social/providers);
 *    tombol HANYA tampil bila `enabled` (G002). Bila provider tidak
 *    dikonfigurasi di server, tombol TIDAK dirender — tidak ada klaim
 *    palsu (G005: tidak ada tombol mati).
 *  - OAuth via lib/social-oauth.ts (expo-auth-session + expo-apple-authentication).
 *    Backend menukar `idToken` menjadi sesi Kahade; nonce diikat ke percobaan
 *    ini (G011).
 *  - Registrasi TETAP nomor HP: identitas social tanpa akun tertaut →
 *    `linkRequired` → pemanggil mengarahkan ke pendaftaran nomor HP; linkToken
 *    dipakai untuk menautkan setelah nomor terverifikasi.
 *  - Status: loading per-provider, dibatalkan user (diam), error + coba lagi,
 *    callback kedaluwarsa (G017).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, View } from "react-native"
import * as AppleAuthentication from "expo-apple-authentication"

import { api } from "@/lib/api"
import type { SocialLoginResult, SocialProvider, SocialProviderCapability } from "@/lib/api/social"
import {
  SocialCancelledError,
  getSocialIdToken,
  isAppleButtonSupported,
} from "@/lib/social-oauth"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { logWarn } from "@/lib/telemetry"

export type SocialOutcome =
  | { kind: "session" }
  | { kind: "twoFactor"; tempToken: string }
  | { kind: "phoneMigration"; migrationToken: string }
  | { kind: "linkRequired"; linkToken: string }
  | { kind: "confirmLink"; linkToken: string; maskedEmail?: string; provider: SocialProvider }

interface SocialLoginButtonsProps {
  /** Dipanggil sebelum OAuth dimulai (mis. simpan nextPath). */
  onBeforeStart?: () => void
  onOutcome: (outcome: SocialOutcome) => void
  onError?: (message: string) => void
}

export function SocialLoginButtons({ onBeforeStart, onOutcome, onError }: SocialLoginButtonsProps) {
  const [capabilities, setCapabilities] = useState<SocialProviderCapability[] | null>(null)
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const byProvider = useMemo(() => {
    const map = new Map<SocialProvider, SocialProviderCapability>()
    for (const c of capabilities ?? []) if (c.enabled) map.set(c.provider, c)
    return map
  }, [capabilities])

  useEffect(() => {
    let alive = true
    api.social
      .getProviders()
      .then((list) => {
        if (alive) setCapabilities(list)
      })
      .catch((err) => logWarn("social:providers", err))
    return () => {
      alive = false
    }
  }, [])

  const finish = useCallback(
    async (result: SocialLoginResult) => {
      if (result.kind === "session") onOutcome({ kind: "session" })
      else if (result.kind === "twoFactor") onOutcome({ kind: "twoFactor", tempToken: result.tempToken })
      else if (result.kind === "phoneMigration")
        onOutcome({ kind: "phoneMigration", migrationToken: result.migrationToken })
      else if (result.kind === "confirmLink")
        onOutcome({
          kind: "confirmLink",
          linkToken: result.linkToken,
          maskedEmail: result.maskedEmail,
          provider: result.provider,
        })
      else onOutcome({ kind: "linkRequired", linkToken: result.linkToken })
    },
    [onOutcome],
  )

  const start = useCallback(
    async (provider: SocialProvider) => {
      const cap = byProvider.get(provider)
      const clientId = cap?.appId
      if (!cap || !clientId || activeProvider) return
      setCancelled(false)
      setFailed(null)
      onBeforeStart?.()
      setActiveProvider(provider)
      try {
        const { idToken, nonce } = await getSocialIdToken(provider, clientId)
        const result = await api.social.socialLogin({ provider, idToken, nonce })
        await finish(result)
      } catch (err) {
        if (err instanceof SocialCancelledError) {
          setCancelled(true)
          return
        }
        const label = provider === "GOOGLE" ? "Google" : "Apple"
        setFailed(`Login ${label} gagal. Periksa koneksi lalu coba lagi.`)
        const msg = err instanceof Error ? err.message : String(err ?? "")
        onError?.(msg)
        logWarn("social:login-failed", { provider, msg })
      } finally {
        setActiveProvider(null)
      }
    },
    [byProvider, activeProvider, onBeforeStart, finish, onError],
  )

  const showGoogle = byProvider.has("GOOGLE")
  const showApple = byProvider.has("APPLE") && isAppleButtonSupported()

  if (capabilities !== null && !showGoogle && !showApple) return null

  return (
    <View className="gap-2">
      {showGoogle ? (
        <Button
          variant="secondary"
          disabled={activeProvider !== null}
          loading={activeProvider === "GOOGLE"}
          onPress={() => void start("GOOGLE")}
        >
          Masuk dengan Google
        </Button>
      ) : null}
      {showApple ? (
        Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={{ height: 48 }}
            onPress={() => void start("APPLE")}
          />
        ) : (
          <Button
            variant="secondary"
            disabled={activeProvider !== null}
            loading={activeProvider === "APPLE"}
            onPress={() => void start("APPLE")}
          >
            Masuk dengan Apple
          </Button>
        )
      ) : null}
      {cancelled ? (
        <Alert tone="info">Login dibatalkan. Anda bisa mencoba lagi kapan saja.</Alert>
      ) : null}
      {failed ? <Alert tone="danger">{failed}</Alert> : null}
    </View>
  )
}
