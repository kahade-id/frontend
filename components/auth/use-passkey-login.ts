/**
 * Kahade — hook alur masuk passkey (overhaul auth 2026-10-10).
 *
 * Satu sumber untuk "minta assertion WebAuthn → tukar ke sesi Kahade →
 * arahkan hasil". Sebelumnya logika ini hidup di dalam
 * components/auth/login-password-form.tsx sebagai tautan kecil di bawah form
 * kata sandi; di arsitektur baru passkey adalah tombol primer di hub Masuk,
 * jadi alurnya diangkat ke hook agar dua pemakai (tombol hub + mediasi
 * conditional di halaman email/username) tidak menyalin cabang navigasi yang
 * sama — cabang yang justru paling mahal kalau berbeda (2FA, migrasi nomor).
 *
 * Keputusan non-obvious:
 *   - Kapabilitas dibaca ASINKRON saat mount (`getPasskeyCapability`), tetapi
 *     tombol TIDAK disabled sambil menunggu: probe diulang di dalam `start()`.
 *     Tombol yang mati tanpa alasan terbaca seperti bug; penjelasan spesifik
 *     setelah ketuk jauh lebih jujur.
 *   - Pembatalan pengguna (PasskeyError CANCELLED) DIAM — tidak ada Alert,
 *     tidak ada toast (konvensi T4-011 yang sama dengan OAuth sosial).
 *   - Perangkat tidak mendukung bukan "error": hook memisahkannya ke
 *     `explainUnsupported` supaya pemanggil menampilkan Dialog penjelasan +
 *     jalan keluar, bukan Alert merah yang menyalahkan pengguna.
 *   - Error ApiError dipetakan per kode (rate limit / tidak dikenali /
 *     jaringan) — pesan generik "Gagal masuk" menyembunyikan penyebab yang
 *     justru bisa diperbaiki pengguna sendiri.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  getPasskeyCapability,
  PasskeyError,
  startPasskeyAuthentication,
  type AuthenticationOptionsJSON,
  type PasskeyCapability,
} from "@/lib/passkey"
import { PASSKEY_COPY } from "@/lib/passkey-instructions"
import { logWarn } from "@/lib/telemetry"
import { ROUTES } from "@/lib/routes"
import { setPendingMigrationToken } from "@/lib/phone-migration-token"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import { useLoginNavigation } from "@/components/auth/use-login-navigation"

export type UsePasskeyLoginOptions = {
  /** Tujuan setelah masuk berhasil (diteruskan ke resolvePostLoginTarget). */
  nextPath?: string
  /**
   * Mediasi conditional (autofill passkey di kolom kredensial, G041/G043).
   * Hanya bermakna di web dan hanya bila ada kolom input yang bisa ditempeli
   * saran — karena itu hub Masuk (tanpa kolom) tidak memakainya, sedangkan
   * halaman Email/Username memakainya.
   */
  conditional?: boolean
}

export type PasskeyLogin = {
  /** null = probe belum selesai. */
  capability: PasskeyCapability | null
  submitting: boolean
  /** Pesan error siap tampil (sudah Bahasa Indonesia & spesifik). */
  error: string | null
  dismissError: () => void
  /** Perangkat/browser tidak mendukung → tampilkan penjelasan, bukan error. */
  explainUnsupported: boolean
  dismissExplanation: () => void
  /**
   * Jalankan alur masuk passkey. `identifier` opsional: halaman Email/Username
   * meneruskan identitas yang sudah diketik agar server mempersempit
   * `allowCredentials`; hub Masuk membiarkannya kosong (discoverable).
   */
  start: (identifier?: string) => Promise<void>
}

/**
 * Pesan error siap tampil. Copy-nya dari PASSKEY_COPY.loginErrors (lib/) agar
 * terkatalog i18n — literal di dalam fungsi komponen tidak pernah sampai ke
 * kamus English.
 */
function describeError(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === "RATE_LIMITED") return PASSKEY_COPY.loginErrors.rateLimited
    if (err.code === "UNAUTHORIZED" || err.code === "NOT_FOUND" || err.code === "FORBIDDEN") {
      return PASSKEY_COPY.loginErrors.unknownCredential
    }
    if (err.code === "NETWORK" || err.code === "TIMEOUT" || err.isTransient) {
      return PASSKEY_COPY.loginErrors.network
    }
  }
  return userMessage(err)
}

export function usePasskeyLogin({ nextPath, conditional = false }: UsePasskeyLoginOptions = {}): PasskeyLogin {
  const router = useRouter()
  const { beginLogin, finishLogin } = useLoginNavigation(nextPath)
  const [capability, setCapability] = useState<PasskeyCapability | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explainUnsupported, setExplainUnsupported] = useState(false)
  // Mediasi conditional hanya boleh dimulai sekali per mount: efeknya menunggu
  // interaksi pengguna tanpa batas waktu, dan mengulanginya akan menumpuk
  // permintaan `auth/options` setiap kali komponen dirender ulang.
  const conditionalStarted = useRef(false)

  const probe = useCallback(async (): Promise<PasskeyCapability> => {
    const next = await getPasskeyCapability()
    setCapability(next)
    return next
  }, [])

  useEffect(() => {
    let alive = true
    void getPasskeyCapability()
      .then((next) => {
        if (alive) setCapability(next)
      })
      .catch((err) => logWarn("passkey:capability", err))
    return () => {
      alive = false
    }
  }, [])

  const finish = useCallback(
    async (result: Awaited<ReturnType<typeof api.passkey.verifyAuthLogin>>, identifier: string) => {
      if ("requiresPhoneMigration" in result && result.requiresPhoneMigration) {
        setPendingMigrationToken(result.migrationToken)
        router.replace(ROUTES.phoneMigration())
        return
      }
      if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
        setPendingTwoFactorLogin({ tempToken: result.tempToken, identifier })
        router.push(ROUTES.verify2fa)
        return
      }
      await finishLogin()
    },
    [finishLogin, router],
  )

  const start = useCallback(
    async (identifier?: string) => {
      if (submitting) return
      const trimmed = identifier?.trim() ?? ""
      setSubmitting(true)
      setError(null)
      beginLogin()
      try {
        const supported = (capability ?? (await probe())).supported
        if (!supported) {
          setExplainUnsupported(true)
          return
        }
        const { challengeId, options } = await api.passkey.getAuthOptions(
          trimmed ? { username: trimmed } : {},
        )
        const assertion = await startPasskeyAuthentication(
          options as AuthenticationOptionsJSON,
          conditional ? { conditional: true } : {},
        )
        const result = await api.passkey.verifyAuthLogin({ challengeId, assertion })
        await finish(result, trimmed)
      } catch (err) {
        if (err instanceof PasskeyError) {
          // Pembatalan = diam (T4-011). Selain itu: pesan spesifik dari
          // lib/passkey.ts, atau penjelasan dukungan untuk NOT_SUPPORTED.
          if (err.code === "CANCELLED") return
          if (err.code === "NOT_SUPPORTED") {
            setExplainUnsupported(true)
            return
          }
          setError(err.message)
          logWarn("passkey:login-failed", { code: err.code })
          return
        }
        setError(describeError(err))
        logWarn("passkey:login-failed", {
          msg: err instanceof Error ? err.message : String(err ?? ""),
        })
      } finally {
        setSubmitting(false)
      }
    },
    [beginLogin, capability, conditional, finish, probe, submitting],
  )

  /**
   * G041/G043: di browser yang mendukung, passkey ditawarkan sebagai saran
   * otomatis pada kolom kredensial. Kegagalan di jalur ini SELALU ditelan —
   * autofill adalah kenyamanan, bukan metode yang dijanjikan, dan form kata
   * sandi di halaman yang sama harus tetap bisa dipakai.
   */
  useEffect(() => {
    if (!conditional || conditionalStarted.current) return
    conditionalStarted.current = true
    void (async () => {
      try {
        const cap = await getPasskeyCapability()
        setCapability(cap)
        if (!cap.supported || !cap.conditionalMediation) return
        beginLogin()
        const { challengeId, options } = await api.passkey.getAuthOptions()
        const assertion = await startPasskeyAuthentication(
          options as AuthenticationOptionsJSON,
          { conditional: true },
        )
        const result = await api.passkey.verifyAuthLogin({ challengeId, assertion })
        await finish(result, "")
      } catch {
        // Diam: lihat docblock.
      }
    })()
  }, [conditional, beginLogin, finish])

  const dismissError = useCallback(() => setError(null), [])
  const dismissExplanation = useCallback(() => setExplainUnsupported(false), [])

  return {
    capability,
    submitting,
    error,
    dismissError,
    explainUnsupported,
    dismissExplanation,
    start,
  }
}
