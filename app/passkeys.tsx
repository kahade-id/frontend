/**
 * Screen — Kelola Passkey (GAP-A: G034, G037–G039, G047, G048).
 *
 * - Daftar passkey + tambah / ganti nama / hapus — semua mutasi wajib
 *   re-auth (kata sandi / kode 2FA / OTP WhatsApp) sesuai kebijakan backend.
 * - Jelas membedakan "Passkey" (kredensial WebAuthn terverifikasi server)
 *   dari "Kunci biometrik perangkat" (app-lock lokal — bukan metode masuk).
 * - Pendaftaran passkey baru hanya di web (G033): di native tombol tambah
 *   menampilkan penjelasan jujur + mengarahkan ke web.
 * - Pemulihan bila semua passkey hilang: OTP WhatsApp 2 langkah (G039).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, View } from "react-native"
import { Fingerprint, Plus, Trash, PencilSimple, ShieldWarning } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { PasskeySummary } from "@/lib/api/passkey"
import { formatDate } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import {
  getPasskeyCapability,
  getPasskeyCapabilitySync,
  startPasskeyRegistration,
  type PasskeyCapability,
  type RegistrationOptionsJSON,
} from "@/lib/passkey"
import { PASSKEY_COPY, passkeyUnsupportedCopy } from "@/lib/passkey-instructions"
import { showMutationError } from "@/lib/mutation-toast"
import { MFA_CODE_MAX_LENGTH, normalizeMfaCode } from "@/lib/auth-ui"
import { retryAfterMessage, useRetryCooldown } from "@/lib/retry-cooldown"
import { translate } from "@/lib/i18n/translate"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { SensitiveConfirmDialog } from "@/components/ui/sensitive-confirm"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type ReauthInput = { password?: string; mfaCode?: string; otpCode?: string }

/**
 * UI-A010: `onSubmit` opsional — tombol "done" keyboard ikut men-submit dialog
 * (sebelumnya tidak melakukan apa-apa).
 */
function ReauthFields({
  value,
  onChange,
  onSubmit,
}: {
  value: ReauthInput
  onChange: (v: ReauthInput) => void
  onSubmit?: () => void
}) {
  return (
    <View className="gap-3">
      <PasswordField
        label="Kata sandi"
        value={value.password ?? ""}
        onChangeText={(t) => onChange({ ...value, password: t })}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <Input
        label="Kode 2FA (bila aktif)"
        value={value.mfaCode ?? ""}
        // #FE-I1: dulu number-pad + maxLength 6 → kode cadangan (10–16
        // alfanumerik) mustahil dimasukkan; pengguna yang kehilangan
        // autentikator tidak bisa mengelola passkey (UI-A001 di tempat lain).
        onChangeText={(t) => onChange({ ...value, mfaCode: normalizeMfaCode(t) })}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={MFA_CODE_MAX_LENGTH}
        helperText="6 digit autentikator atau kode cadangan. Kosongkan bila 2FA tidak aktif."
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    </View>
  )
}

/**
 * UI-A004: memakai `formatDate` dari lib/format.ts (§13) — sebelumnya memakai
 * `toLocaleDateString` langsung yang tidak konsisten dengan seluruh app.
 */

export default function PasskeysScreen() {
  const toast = useToast()
  const query = useApiQuery("passkeys", (signal) => api.passkey.listPasskeys(signal))
  const items = useMemo(() => query.data ?? [], [query.data])
  const { setData } = query

  const [reauthFor, setReauthFor] = useState<null | { action: "add" }>(null)
  const [reauthInput, setReauthInput] = useState<ReauthInput>({})
  const [working, setWorking] = useState(false)

  const [renameTarget, setRenameTarget] = useState<PasskeySummary | null>(null)
  const [renameName, setRenameName] = useState("")

  const [revokeTarget, setRevokeTarget] = useState<PasskeySummary | null>(null)
  const [revokeReauthOpen, setRevokeReauthOpen] = useState(false)

  const [recoverOpen, setRecoverOpen] = useState(false)
  const [recoverOtp, setRecoverOtp] = useState("")
  const [recoverStep, setRecoverStep] = useState<"request" | "verify">("request")
  // #FE-L4: permintaan OTP pemulihan dibatasi (60 d / Retry-After server).
  const recoverCooldown = useRetryCooldown()

  const isLastCredential = items.length === 1
  /**
   * Bagian 5 (overhaul auth 2026-10-10): ketersediaan passkey dibaca ASINKRON
   * karena di native jawabannya datang dari seam provider
   * (lib/passkey-native.ts), bukan dari `navigator.credentials`.
   * `getPasskeyCapabilitySync()` tetap jadi nilai frame pertama supaya web
   * tidak berkedip "belum didukung" sebelum probe selesai.
   */
  const [capability, setCapability] = useState<PasskeyCapability | null>(null)
  useEffect(() => {
    let alive = true
    void getPasskeyCapability()
      .then((next) => {
        if (alive) setCapability(next)
      })
      .catch(() => {
        // Probe gagal = anggap tidak didukung; layar tetap bisa dipakai untuk
        // melihat & menghapus passkey yang sudah terdaftar.
        if (alive) setCapability({ supported: false, conditionalMediation: false, platformAuthenticator: false })
      })
    return () => {
      alive = false
    }
  }, [])
  const webSupported = capability?.supported ?? getPasskeyCapabilitySync().supported

  const refresh = useCallback(async () => {
    try {
      setData(await api.passkey.listPasskeys())
    } catch {
      // Biarkan query yang menampilkan error; toast opsional di pemanggil.
    }
  }, [setData])

  // ── Tambah ─────────────────────────────────────────────────────────

  // A12 (batch 139): nama perangkat saat create — user bisa menamai sendiri,
  // default otomatis seperti sebelumnya bila dikosongkan.
  const defaultPasskeyName = useCallback(
    () => `${Platform.OS === "web" ? "Web" : "Perangkat"} — ${formatDate(new Date())}`,
    [],
  )
  const [addName, setAddName] = useState("")

  const handleAdd = useCallback(() => {
    if (!webSupported) {
      // Penjelasan mengikuti ALASANNYA (browser tanpa WebAuthn vs aplikasi
      // native), bukan satu pesan untuk semua penyebab.
      const info = passkeyUnsupportedCopy(capability?.reason)
      toast.show({
        title: info.title,
        description: info.body,
        tone: "neutral",
        duration: 6000,
      })
      return
    }
    setReauthInput({})
    setAddName(defaultPasskeyName())
    setReauthFor({ action: "add" })
  }, [capability?.reason, webSupported, toast.show, defaultPasskeyName])

  const doAddWithReauth = useCallback(
    async (reauth: ReauthInput) => {
      setWorking(true)
      try {
        const { challengeId, options } = await api.passkey.getRegisterOptions({
          password: reauth.password || undefined,
          mfaCode: reauth.mfaCode || undefined,
          otpCode: reauth.otpCode || undefined,
          // A12: nama dari input user; fallback default bila dikosongkan.
          deviceName: addName.trim() || defaultPasskeyName(),
        })
        const attestation = await startPasskeyRegistration(options as RegistrationOptionsJSON)
        const created = await api.passkey.verifyRegistration({ challengeId, attestation })
        setReauthFor(null)
        await refresh()
        toast.show({
          title: translate("Passkey “{x}” terdaftar", { x: created.deviceName }),
          description: "Anda kini bisa masuk tanpa mengetik kata sandi di perangkat ini.",
          tone: "success",
        })
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal mendaftarkan passkey",
            uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
            err: err,
            scope: "passkeys:mendaftarkan-passkey",
          })
        ) {
          void refresh()
        }
      } finally {
        setWorking(false)
      }
    },
    [refresh, toast.show, addName, defaultPasskeyName],
  )

  // ── Ganti nama ─────────────────────────────────────────────────────

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) return
    setWorking(true)
    try {
      await api.passkey.renamePasskey(renameTarget.id, {
        deviceName: renameName.trim(),
        password: reauthInput.password || undefined,
        mfaCode: reauthInput.mfaCode || undefined,
        otpCode: reauthInput.otpCode || undefined,
      })
      setRenameTarget(null)
      setRenameName("")
      await refresh()
      toast.show({ title: "Nama passkey diperbarui", tone: "success" })
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengganti nama",
          uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
          err: err,
          scope: "passkeys:mengganti-nama",
        })
      ) {
        void refresh()
      }
    } finally {
      setWorking(false)
    }
  }, [renameTarget, renameName, reauthInput, refresh, toast.show])

  // ── Hapus ──────────────────────────────────────────────────────────

  const confirmRevoke = useCallback(() => {
    setReauthInput({})
    setRevokeReauthOpen(true)
  }, [])

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return
    setWorking(true)
    try {
      await api.passkey.revokePasskey(revokeTarget.id, {
        password: reauthInput.password || undefined,
        mfaCode: reauthInput.mfaCode || undefined,
        otpCode: reauthInput.otpCode || undefined,
      })
      setRevokeReauthOpen(false)
      setRevokeTarget(null)
      await refresh()
      toast.show({ title: "Passkey dihapus", tone: "success" })
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal menghapus passkey",
          uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
          err: err,
          scope: "passkeys:menghapus-passkey",
        })
      ) {
        void refresh()
      }
    } finally {
      setWorking(false)
    }
  }, [revokeTarget, reauthInput, refresh, toast.show])

  // ── Pemulihan (G039) ───────────────────────────────────────────────

  const handleRecoverRequest = useCallback(async () => {
    if (recoverCooldown.isCoolingDown) return
    setWorking(true)
    try {
      const res = await api.passkey.recoverPasskey({ step: "request" })
      setRecoverStep("verify")
      recoverCooldown.start(60_000)
      toast.show({ title: res.message, tone: "success" })
    } catch (err) {
      if (recoverCooldown.startFromError(err)) {
        toast.show({
          title: "Gagal mengirim OTP",
          description: retryAfterMessage(err, "Terlalu banyak permintaan OTP. Tunggu sebentar lalu coba lagi."),
          tone: "danger",
        })
        return
      }
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: "Gagal mengirim OTP",
        uncertainHint: "Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi.",
        err: err,
        scope: "passkeys:mengirim-otp",
      })
    } finally {
      setWorking(false)
    }
  }, [toast.show, recoverCooldown])

  const handleRecoverVerify = useCallback(async () => {
    if (!recoverOtp.trim()) return
    setWorking(true)
    try {
      const res = await api.passkey.recoverPasskey({ step: "verify", otpCode: recoverOtp.trim() })
      setRecoverOpen(false)
      setRecoverStep("request")
      setRecoverOtp("")
      if (webSupported && res.reauthToken) {
        // Lanjutkan langsung ke pendaftaran passkey baru dengan token sekali pakai.
        setReauthInput({})
        const { challengeId, options } = await api.passkey.getRegisterOptions({
          reauthToken: res.reauthToken,
          deviceName: `Web — ${formatDate(new Date())}`,
        })
        const attestation = await startPasskeyRegistration(options as RegistrationOptionsJSON)
        await api.passkey.verifyRegistration({ challengeId, attestation })
        await refresh()
        toast.show({ title: "Passkey baru terdaftar", tone: "success" })
      } else {
        toast.show({
          title: "Verifikasi berhasil",
          description: res.newDevice
            ? "Perangkat baru terdeteksi — kami mengirim notifikasi keamanan. Daftarkan passkey baru dari aplikasi web."
            : "Daftarkan passkey baru dari aplikasi web Kahade.",
          tone: "success",
          duration: 6000,
        })
      }
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: "Verifikasi gagal",
          uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
          err: err,
          scope: "passkeys:verifikasi",
        })
      ) {
        void refresh()
      }
    } finally {
      setWorking(false)
    }
  }, [recoverOtp, refresh, toast.show, webSupported])

  return (
    <>
      <DataScreen
        title="Passkey"
        state={query}
        loadingMessage="Memuat passkey…"
        empty={
          items.length === 0 && {
            icon: Fingerprint,
            title: "Belum ada passkey",
            description:
              "Daftarkan passkey agar bisa masuk tanpa kata sandi — memakai sidik jari, wajah, atau kunci keamanan.",
          }
        }
        contentClassName="gap-3"
      >
        <View className="rounded-lg bg-surface p-4 gap-2">
          <Text variant="body" weight={600}>
            {PASSKEY_COPY.vsDeviceBiometric.title}
          </Text>
          <Text variant="caption" tone="secondary">
            {PASSKEY_COPY.vsDeviceBiometric.passkey}
          </Text>
          <Text variant="caption" tone="secondary">
            {PASSKEY_COPY.vsDeviceBiometric.biometric}
          </Text>
        </View>

        {items.map((item) => (
          <View key={item.id} className="rounded-lg bg-surface p-4 gap-1">
            <View className="flex-row items-center gap-3">
              <Fingerprint size={22} />
              <View className="flex-1">
                <Text variant="body" weight={600}>
                  {item.deviceName}
                </Text>
                <Text variant="caption" tone="secondary">
                  Dibuat {formatDate(item.createdAt)}
                  {item.lastUsedAt ? ` · Terakhir dipakai ${formatDate(item.lastUsedAt)}` : " · Belum pernah dipakai"}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                fullWidth={false}
                leftIcon={PencilSimple}
                onPress={() => {
                  setRenameTarget(item)
                  setRenameName(item.deviceName)
                  setReauthInput({})
                }}
              >
                Ganti nama
              </Button>
              <Button
                variant="destructive"
                size="sm"
                fullWidth={false}
                leftIcon={Trash}
                onPress={() => setRevokeTarget(item)}
              >
                Hapus
              </Button>
            </View>
          </View>
        ))}

        <Button leftIcon={Plus} onPress={handleAdd}>
          Tambah passkey
        </Button>
        <Button variant="ghost" leftIcon={ShieldWarning} onPress={() => setRecoverOpen(true)}>
          {PASSKEY_COPY.recover.title}
        </Button>
        <Text variant="caption" tone="secondary">
          Maksimal 10 passkey per akun. Menghapus passkey tidak menghapus akun Anda.
        </Text>
      </DataScreen>

      {/* Re-auth untuk tambah (+ A12: nama perangkat saat create) */}
      <Dialog
        visible={reauthFor !== null}
        onRequestClose={() => setReauthFor(null)}
        title="Verifikasi ulang"
        description="Demi keamanan, verifikasi ulang identitas Anda sebelum mendaftarkan passkey."
        confirmLabel="Verifikasi & daftarkan"
        onConfirm={() => reauthFor && void doAddWithReauth(reauthInput)}
        loading={working}
      >
        <View className="gap-3">
          <Input
            label="Nama perangkat"
            value={addName}
            onChangeText={setAddName}
            maxLength={100}
            placeholder="mis. Laptop kerja"
            returnKeyType="done"
            onSubmitEditing={() => reauthFor && void doAddWithReauth(reauthInput)}
          />
          <ReauthFields
            value={reauthInput}
            onChange={setReauthInput}
            onSubmit={() => reauthFor && void doAddWithReauth(reauthInput)}
          />
        </View>
      </Dialog>

      {/* Ganti nama (+ re-auth inline) */}
      <Dialog
        visible={renameTarget !== null}
        onRequestClose={() => setRenameTarget(null)}
        title="Ganti nama passkey"
        confirmLabel="Simpan"
        onConfirm={() => void handleRename()}
        loading={working}
        confirmButtonProps={{ disabled: !renameName.trim() }}
      >
        <View className="gap-3">
          <Input
            label="Nama perangkat"
            value={renameName}
            onChangeText={setRenameName}
            maxLength={100}
            placeholder="mis. Laptop kerja"
            returnKeyType="done"
            onSubmitEditing={() => void handleRename()}
          />
          <ReauthFields
            value={reauthInput}
            onChange={setReauthInput}
            onSubmit={() => void handleRename()}
          />
        </View>
      </Dialog>

      {/* Konfirmasi hapus — A11: pola konfirmasi sensitif seragam */}
      <SensitiveConfirmDialog
        visible={revokeTarget !== null && !revokeReauthOpen}
        title="Hapus passkey?"
        description={isLastCredential ? PASSKEY_COPY.lastCredentialWarning : undefined}
        consequences={
          isLastCredential
            ? ["Ini satu-satunya kredensial masuk Anda — pastikan masih ada cara lain untuk masuk."]
            : [
                translate("Passkey “{x}” tidak bisa lagi dipakai untuk masuk setelah dihapus.", {
                  x: revokeTarget?.deviceName ?? "",
                }),
                "Menghapus passkey tidak menghapus akun Anda.",
              ]
        }
        confirmLabel="Ya, hapus"
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />

      {/* Re-auth untuk hapus */}
      <Dialog
        visible={revokeReauthOpen}
        onRequestClose={() => {
          setRevokeReauthOpen(false)
          setRevokeTarget(null)
        }}
        title="Verifikasi ulang"
        description="Verifikasi ulang identitas Anda untuk menghapus passkey ini."
        confirmLabel="Hapus passkey"
        destructive
        onConfirm={() => void handleRevoke()}
        loading={working}
      >
        <ReauthFields
          value={reauthInput}
          onChange={setReauthInput}
          onSubmit={() => void handleRevoke()}
        />
      </Dialog>

      {/* Pemulihan (G039) */}
      <Dialog
        visible={recoverOpen}
        onRequestClose={() => {
          setRecoverOpen(false)
          setRecoverStep("request")
          setRecoverOtp("")
        }}
        title={PASSKEY_COPY.recover.title}
        description={PASSKEY_COPY.recover.body}
        confirmLabel={
          recoverStep === "request"
            ? recoverCooldown.label(PASSKEY_COPY.recover.requestButton)
            : PASSKEY_COPY.recover.verifyButton
        }
        onConfirm={() =>
          void (recoverStep === "request" ? handleRecoverRequest() : handleRecoverVerify())
        }
        loading={working}
      >
        {recoverStep === "verify" && (
          <Input
            label="Kode OTP WhatsApp"
            value={recoverOtp}
            onChangeText={setRecoverOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6 digit"
          />
        )}
      </Dialog>
    </>
  )
}
