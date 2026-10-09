/**
 * Kahade — <PasskeyLoginButton> tombol primer "Masuk dengan Passkey".
 *
 * Di arsitektur masuk yang baru (2026-10-10) passkey adalah salah satu dari
 * tiga aksi besar di hub Masuk, setara Google/Apple — bukan lagi tautan kecil
 * di bawah form kata sandi. Seluruh logika alur ada di usePasskeyLogin; di sini
 * hanya presentasi + penjelasan jujur saat perangkat tidak mendukung.
 *
 * Keputusan non-obvious:
 *   - Tombol SELALU dirender (tidak menunggu hasil probe kapabilitas). Tombol
 *     yang hilang/mati tanpa alasan terbaca seperti bug; penjelasan spesifik
 *     setelah ketuk jauh lebih berguna. Probe tetap jalan saat mount supaya
 *     Dialog-nya sudah punya konteks.
 *   - Perangkat tidak mendukung → <Dialog> berisi alasan + jalan keluar
 *     (WhatsApp / Email / Username), bukan Alert merah. Passkey bukan
 *     kegagalan pengguna.
 *   - Pembatalan autentikator = diam (konvensi T4-011, sama dengan OAuth).
 */
import { useCallback } from "react"
import { Fingerprint } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import {
  usePasskeyLogin,
  type UsePasskeyLoginOptions,
} from "@/components/auth/use-passkey-login"
import { PASSKEY_COPY } from "@/lib/passkey-instructions"

export type PasskeyLoginButtonProps = UsePasskeyLoginOptions & {
  /** Label tombol. Default copy standar PASSKEY_COPY.loginButton. */
  label?: string
}

export function PasskeyLoginButton({ label, ...options }: PasskeyLoginButtonProps) {
  const passkey = usePasskeyLogin(options)

  const handlePress = useCallback(() => {
    void passkey.start()
  }, [passkey])

  return (
    <VStack gap={3}>
      <Button
        variant="secondary"
        leftIcon={Fingerprint}
        loading={passkey.submitting}
        disabled={passkey.submitting}
        onPress={handlePress}
        accessibilityHint="Masuk memakai sidik jari, wajah, atau kunci layar perangkat"
      >
        {label ?? PASSKEY_COPY.loginButton}
      </Button>

      {passkey.error ? (
        <Alert tone="danger" onDismiss={passkey.dismissError}>
          {passkey.error}
        </Alert>
      ) : null}

      <Dialog
        visible={passkey.explainUnsupported}
        title={PASSKEY_COPY.loginNativeInfo.title}
        description={PASSKEY_COPY.loginNativeInfo.body}
        confirmLabel="Mengerti"
        hideCancel
        onConfirm={passkey.dismissExplanation}
        onCancel={passkey.dismissExplanation}
        onRequestClose={passkey.dismissExplanation}
      >
        <Text variant="caption" tone="secondary" className="text-pretty">
          {PASSKEY_COPY.vsDeviceBiometric.passkey}
        </Text>
      </Dialog>
    </VStack>
  )
}
