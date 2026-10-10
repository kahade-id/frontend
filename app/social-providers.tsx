/**
 * Screen — Login Sosial (GAP-A G013/G014/G018/G019).
 *
 * Kelola provider Google/Apple yang tertaut ke akun:
 *  - GET /v1/auth/social → daftar tertaut (provider + email + waktu taut).
 *  - Tautkan: OAuth → re-auth (kata sandi/OTP + 2FA) → POST /v1/auth/social/link.
 *  - Lepas: konfirmasi → re-auth → DELETE /v1/auth/social/:provider.
 *    Server menolak bila ini satu-satunya metode masuk (SOCIAL_LAST_METHOD) —
 *    pesan itu ditampilkan jujur, bukan disembunyikan.
 */

import { useCallback, useState } from "react"

import { translate } from "@/lib/i18n/translate"
import { View } from "react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import type { LinkedSocialProvider, SocialProvider } from "@/lib/api/social"
import { formatDate } from "@/lib/format"
import { SocialCancelledError, getSocialIdToken, isAppleButtonSupported } from "@/lib/social-oauth"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { showMutationError } from "@/lib/mutation-toast"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { ListItem } from "@/components/ui/list-item"
import { PasswordField } from "@/components/ui/password-field"
import { Text } from "@/components/ui/text"
import { MenuGroupLabel } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

const PROVIDER_LABEL: Record<SocialProvider, string> = { GOOGLE: "Google", APPLE: "Apple" }

export default function SocialProvidersScreen() {
  const toast = useToast()

  const linkedQuery = useApiQuery("social-linked", (signal) => api.social.listLinked(signal))
  const capsQuery = useApiQuery("social-caps", (signal) => api.social.getProviders(signal))

  const [reauthFor, setReauthFor] = useState<
    { mode: "link"; provider: SocialProvider; idToken: string; nonce?: string } | { mode: "unlink"; provider: SocialProvider } | null
  >(null)
  const [password, setPassword] = useState("")
  const [reauthBusy, setReauthBusy] = useState(false)
  const [reauthError, setReauthError] = useState<string | null>(null)
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null)

  const linked = linkedQuery.data ?? []
  const linkedSet = new Set(linked.map((l) => l.provider))
  const caps = new Map((capsQuery.data ?? []).filter((c) => c.enabled).map((c) => [c.provider, c]))

  const reload = useCallback(() => {
    void linkedQuery.reload()
  }, [linkedQuery])

  const startLink = useCallback(
    async (provider: SocialProvider) => {
      const clientId = caps.get(provider)?.appId
      if (!clientId || busyProvider) return
      setBusyProvider(provider)
      try {
        const { idToken, nonce } = await getSocialIdToken(provider, clientId)
        setPassword("")
        setReauthError(null)
        setReauthFor({ mode: "link", provider, idToken, nonce })
      } catch (err) {
        if (!(err instanceof SocialCancelledError)) {
          // Klasifikasi toast: error mutasi non-blokir via showMutationError.
          showMutationError(toast.show, {
            failTitle: translate("Gagal memulai tautan {x}", { x: PROVIDER_LABEL[provider] }),
            uncertainHint: "Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi.",
            err: err,
            scope: "social-providers:link",
          })
          logWarn("social:link-oauth", err)
        }
      } finally {
        setBusyProvider(null)
      }
    },
    [caps, busyProvider, toast],
  )

  const confirmUnlink = useCallback((provider: SocialProvider) => {
    setPassword("")
    setReauthError(null)
    setReauthFor({ mode: "unlink", provider })
  }, [])

  const submitReauth = useCallback(async () => {
    if (!reauthFor || reauthBusy || !password) return
    setReauthBusy(true)
    setReauthError(null)
    try {
      if (reauthFor.mode === "link") {
        const result = await api.social.linkSocial({
          provider: reauthFor.provider,
          idToken: reauthFor.idToken,
          nonce: reauthFor.nonce,
          password,
        })
        if (result.requiresConfirmation) {
          // Tidak seharusnya terjadi dari sesi login (konflik email ditolak
          // server); tampilkan jujur bila terjadi.
          setReauthError("Akun ini bentrok dengan akun lain. Hubungi support Kahade.")
          return
        }
        toast.show({ title: translate("{x} ditautkan", { x: PROVIDER_LABEL[reauthFor.provider] }), tone: "success" })
      } else {
        await api.social.unlinkSocial(reauthFor.provider, { password })
        toast.show({ title: translate("Tautan {x} dilepas", { x: PROVIDER_LABEL[reauthFor.provider] }), tone: "success" })
      }
      setReauthFor(null)
      reload()
    } catch (err) {
      if (isApiError(err)) {
        const code = err.backendCode ?? ""
        if (code === "SOCIAL_LAST_METHOD") {
          setReauthError(
            "Ini satu-satunya metode masuk Anda. Tambahkan kata sandi, verifikasi nomor HP, atau metode lain dulu sebelum melepas tautan ini.",
          )
          return
        }
        if (err.code === "UNAUTHORIZED") {
          setReauthError("Kata sandi salah. Coba lagi.")
          return
        }
      }
      setReauthError(userMessage(err))
    } finally {
      setReauthBusy(false)
    }
  }, [reauthFor, reauthBusy, password, toast, reload])

  const linkable = (["GOOGLE", "APPLE"] as SocialProvider[]).filter(
    (p) => caps.has(p) && !linkedSet.has(p) && (p !== "APPLE" || isAppleButtonSupported()),
  )

  return (
    <DataScreen
      title="Login Sosial"
      state={linkedQuery}
      loadingMessage="Memuat provider tertaut"
      errorTitle="Gagal memuat provider tertaut"
    >
      <View className="gap-2">
        <MenuGroupLabel>Tertaut ke akun ini</MenuGroupLabel>
        <View className="w-full overflow-hidden rounded-md bg-surface">
          {linked.length === 0 ? (
            // UX-SPA-015: px-5 agar sejajar baris ListItem saat daftar terisi.
            <Text variant="body" tone="secondary" className="px-5 py-3">
              Belum ada akun Google/Apple yang tertaut. Menautkan memberi Anda cara masuk
              cadangan selain kata sandi.
            </Text>
          ) : (
            linked.map((l: LinkedSocialProvider) => (
              <ListItem
                key={l.provider}
                // BFE-043: provider sudah dinormalisasi UPPERCASE di
                // `listLinked`; fallback menjaga judul tidak pernah blank
                // bila wire mengirim nilai tak dikenal.
                title={PROVIDER_LABEL[l.provider] ?? l.provider}
                titleVariant="bodyLarge"
                // UI-A011: tampilkan kapan ditautkan (§13 formatDate) supaya
                // pengguna bisa membedakan bila beberapa akun provider dipakai.
                subtitle={l.linkedAt ? `Tertaut ${formatDate(l.linkedAt)}` : undefined}
                trailing={
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => confirmUnlink(l.provider)}
                    disabled={busyProvider !== null}
                  >
                    Lepas
                  </Button>
                }
              />
            ))
          )}
        </View>
      </View>

      {linkable.length > 0 ? (
        <View className="gap-2">
          <MenuGroupLabel>Tautkan baru</MenuGroupLabel>
          <View className="gap-2">
            {linkable.map((p) => (
              <Button
                key={p}
                variant="secondary"
                loading={busyProvider === p}
                disabled={busyProvider !== null}
                onPress={() => void startLink(p)}
              >
                Tautkan {PROVIDER_LABEL[p]}
              </Button>
            ))}
          </View>
          <Text variant="caption" tone="secondary" className="text-pretty">
            Penautan meminta kata sandi Anda sebagai konfirmasi — akun Google/Apple tidak bisa
            ditautkan tanpa membuktikan kepemilikan akun Kahade ini.
          </Text>
        </View>
      ) : null}


      <Dialog
        visible={reauthFor !== null}
        onRequestClose={() => setReauthFor(null)}
        title={reauthFor?.mode === "link" ? `Tautkan ${reauthFor ? PROVIDER_LABEL[reauthFor.provider] : ""}` : "Lepas tautan"}
        description={
          reauthFor?.mode === "link"
            ? "Masukkan kata sandi Kahade Anda untuk mengonfirmasi penautan."
            : "Masukkan kata sandi Kahade Anda untuk mengonfirmasi pelepasan. Anda tetap bisa masuk dengan metode lain."
        }
        confirmLabel={reauthFor?.mode === "link" ? "Tautkan" : "Lepas"}
        onConfirm={() => void submitReauth()}
        loading={reauthBusy}
      >
        <View className="gap-2 pt-2">
          {reauthError ? <Alert tone="danger">{reauthError}</Alert> : null}
          <PasswordField
            label="Kata sandi"
            value={password}
            onChangeText={(t) => {
              setPassword(t)
              setReauthError(null)
            }}
            required
            returnKeyType="done"
            onSubmitEditing={() => void submitReauth()}
            disabled={reauthBusy}
            autoFocus
          />
        </View>
      </Dialog>
    </DataScreen>
  )
}
