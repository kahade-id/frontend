/**
 * Seam passkey NATIVE (overhaul auth 2026-10-10, bagian 5).
 *
 * Yang dikunci test ini adalah KEJUJURAN seam, bukan keberhasilannya:
 *   1. Selama provider publik belum bisa membawa options server, aplikasi
 *      native menjawab `supported: false` + ALASAN spesifik — tidak pernah
 *      crash, tidak pernah pura-pura berhasil.
 *   2. Gerbang bentuk provider (`isProviderCapable`) menolak API posisional
 *      ala expo-passkeys@0.1.11 dan menerima provider satu-objek-options.
 *      Tanpa gerbang ini, assertion yang dihasilkan bisa ditolak server dan
 *      terlihat seperti "passkey rusak" di sisi pengguna.
 *   3. Normalisasi encoding (base64 standar → base64url, GUID → 16 byte) dan
 *      adaptor kontrak backend diuji TANPA perangkat: tidak ada simulator di
 *      CI, jadi yang diuji adalah fungsi murninya.
 *
 * Platform di-mock per test karena stub `react-native` bawaan config node
 * men-set `Platform.OS = "web"` — padahal yang diuji justru jalur native.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const platform = vi.hoisted(() => ({
  OS: "ios" as string,
  select: <T,>(specific: { ios?: T; android?: T; default?: T }) =>
    specific.ios ?? specific.default,
}))
vi.mock("react-native", () => ({ Platform: platform }))

const telemetry = vi.hoisted(() => ({ logWarn: vi.fn() }))
vi.mock("@/lib/telemetry", () => ({ logWarn: telemetry.logWarn }))

const {
  NATIVE_PASSKEY_ENABLED,
  authenticateNativePasskey,
  isProviderCapable,
  nativeUnsupportedMessage,
  probeNativePasskey,
  registerNativePasskey,
  resetNativePasskeyCache,
  toAuthenticationResponse,
  toBase64Url,
  toNativePasskeyError,
  toRegistrationResponse,
} = await import("@/lib/passkey-native")
const { PasskeyError } = await import("@/lib/passkey-types")

const REGISTER_OPTIONS = {
  rp: { name: "Kahade", id: "kahade.id" },
  user: { id: "dXNlci0x", name: "budi", displayName: "Budi" },
  challenge: "Y2hhbGxlbmdl",
  pubKeyCredParams: [{ type: "public-key", alg: -7 }],
}
const AUTH_OPTIONS = { challenge: "Y2hhbGxlbmdl", rpId: "kahade.id" }

beforeEach(() => {
  platform.OS = "ios"
  resetNativePasskeyCache()
})

describe("probe ketersediaan passkey native", () => {
  it("seam sengaja mati → DISABLED (bukan crash, bukan klaim didukung)", async () => {
    expect(NATIVE_PASSKEY_ENABLED).toBe(false)
    expect(await probeNativePasskey()).toEqual({ available: false, reason: "DISABLED" })
  })

  it("web → NOT_NATIVE karena jalurnya WebAuthn di lib/passkey.ts", async () => {
    platform.OS = "web"
    resetNativePasskeyCache()
    expect(await probeNativePasskey()).toEqual({ available: false, reason: "NOT_NATIVE" })
  })

  it("android diperlakukan sama dengan iOS: seam yang menentukan, bukan OS-nya", async () => {
    platform.OS = "android"
    resetNativePasskeyCache()
    expect(await probeNativePasskey()).toEqual({ available: false, reason: "DISABLED" })
  })

  it("hasilnya di-cache — tombol masuk tidak boleh menunggu probe berulang", async () => {
    const first = await probeNativePasskey()
    expect(await probeNativePasskey()).toBe(first)
  })
})

describe("alur native saat seam mati", () => {
  it("pendaftaran & login menolak dengan PasskeyError NOT_SUPPORTED", async () => {
    const register = (await registerNativePasskey(REGISTER_OPTIONS).catch(
      (err: unknown) => err,
    )) as InstanceType<typeof PasskeyError>
    const authenticate = (await authenticateNativePasskey(AUTH_OPTIONS).catch(
      (err: unknown) => err,
    )) as InstanceType<typeof PasskeyError>

    expect(register).toBeInstanceOf(PasskeyError)
    expect(register.code).toBe("NOT_SUPPORTED")
    expect(authenticate).toBeInstanceOf(PasskeyError)
    expect(authenticate.code).toBe("NOT_SUPPORTED")
  })

  it("pesannya mengarahkan ke metode masuk lain, bukan 'terjadi kesalahan'", () => {
    const message = nativeUnsupportedMessage("DISABLED")
    expect(message).toMatch(/kata sandi|kode WhatsApp/)
    expect(message).toMatch(/aplikasi web Kahade/)
    expect(message.toLowerCase()).not.toContain("error")
  })

  it("setiap alasan punya pesan; tidak ada alasan yang jatuh ke teks generik kosong", () => {
    for (const reason of [
      "NOT_NATIVE",
      "DISABLED",
      "MODULE_MISSING",
      "PROVIDER_INCOMPLETE",
      "RUNTIME_ERROR",
      undefined,
    ] as const) {
      expect(nativeUnsupportedMessage(reason).length).toBeGreaterThan(20)
    }
  })
})

describe("gerbang bentuk provider (isProviderCapable)", () => {
  it("menolak API posisional expo-passkeys@0.1.11 — options server tak bisa diteruskan", () => {
    // createPasskey(challenge, user, rp, timeout) / getPasskey(challenge, allowCredentials)
    expect(
      isProviderCapable({
        createPasskey: (_challenge: unknown, _user: unknown, _rp: unknown, _timeout: unknown) =>
          Promise.resolve({}),
        getPasskey: (_challenge: unknown, _allow: unknown) => Promise.resolve({}),
      }),
    ).toBe(false)
  })

  it("menerima provider satu objek options (bisa menghormati pilihan server)", () => {
    expect(
      isProviderCapable({
        createPasskey: (_options: unknown) => Promise.resolve({}),
        getPasskey: (_options: unknown) => Promise.resolve({}),
      }),
    ).toBe(true)
  })

  it("menolak modul yang tidak lengkap atau bukan objek", () => {
    expect(isProviderCapable(null)).toBe(false)
    expect(isProviderCapable(undefined)).toBe(false)
    expect(isProviderCapable({})).toBe(false)
    expect(isProviderCapable({ createPasskey: (_o: unknown) => Promise.resolve({}) })).toBe(false)
    expect(isProviderCapable("expo-passkeys")).toBe(false)
  })
})

describe("normalisasi encoding provider native", () => {
  it("base64 standar → base64url tanpa padding (kontrak @simplewebauthn/server)", () => {
    expect(toBase64Url("a+b/c===")).toBe("a-b_c")
    expect(toBase64Url("dXNlci0x")).toBe("dXNlci0x") // sudah base64url: utuh
  })

  it("GUID → 16 byte base64url (bentuk PasskeyUserInfo.id expo-passkeys)", () => {
    expect(toBase64Url("00000000-0000-0000-0000-000000000000")).toBe("AAAAAAAAAAAAAAAAAAAAAA")
    // User handle backend adalah base64url dari byte mentah, bukan teks GUID.
    expect(toBase64Url("01020304-0506-0708-090a-0b0c0d0e0f10")).toBe(
      toBase64Url(btoa(String.fromCharCode(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16))),
    )
  })

  it("null / kosong → null supaya field opsional tidak menjadi string 'null'", () => {
    expect(toBase64Url(null)).toBeNull()
    expect(toBase64Url(undefined)).toBeNull()
    expect(toBase64Url("")).toBeNull()
  })
})

describe("adaptor kontrak backend", () => {
  it("attestation provider → RegistrationResponseJSON dengan base64url", () => {
    expect(
      toRegistrationResponse({
        id: "cred+1=",
        rawId: "raw/2=",
        type: "public-key",
        response: {
          attestationObject: "ao+tation",
          clientDataJSON: "cd/json",
          transports: ["internal", 5, "hybrid"],
        },
        clientExtensionResults: null,
      }),
    ).toEqual({
      id: "cred-1",
      // `+` → `-`, `/` → `_`, padding dibuang (RFC 4648 §5)
      rawId: "raw_2",
      type: "public-key",
      response: {
        attestationObject: "ao-tation",
        clientDataJSON: "cd_json",
        // nilai non-string dibuang: server menolak transports yang bukan enum
        transports: ["internal", "hybrid"],
      },
      clientExtensionResults: {},
    })
  })

  it("assertion provider → AuthenticationResponseJSON, userHandle ikut dinormalkan", () => {
    expect(
      toAuthenticationResponse({
        id: "cred-1",
        rawId: "cred-1",
        response: {
          authenticatorData: "auth+data",
          clientDataJSON: "client/data",
          signature: "sig+nature",
          userHandle: "dXNlci0x",
        },
      }),
    ).toEqual({
      id: "cred-1",
      rawId: "cred-1",
      type: "public-key",
      response: {
        authenticatorData: "auth-data",
        clientDataJSON: "client_data",
        signature: "sig-nature",
        userHandle: "dXNlci0x",
      },
      clientExtensionResults: {},
    })
  })

  it("field wajib hilang → melempar, bukan mengirim payload cacat ke server", () => {
    telemetry.logWarn.mockClear()

    expect(() =>
      toRegistrationResponse({ id: "cred-1", response: { clientDataJSON: "cd" } }),
    ).toThrow(PasskeyError)
    expect(() => toAuthenticationResponse({ id: "cred-1", response: {} })).toThrow(PasskeyError)
    expect(() => toRegistrationResponse(null)).toThrow(PasskeyError)

    // Nama field yang hilang masuk telemetri (untuk tim), bukan ke pesan layar
    // (untuk pengguna) — pesannya tetap satu kalimat yang bisa diterjemahkan.
    expect(telemetry.logWarn).toHaveBeenCalledWith("passkey:native-response", {
      field: "attestationObject",
    })
    expect(telemetry.logWarn).toHaveBeenCalledWith("passkey:native-response", {
      field: "authenticatorData",
    })
  })
})

describe("pemetaan error native ke PasskeyError", () => {
  it.each([
    ["ERR_CANCELED", "CANCELLED"],
    ["user interaction interrupted", "CANCELLED"],
    ["NotAllowedError: user verification timeout", "NOT_ALLOWED"],
    ["no_credential_available", "UNKNOWN"],
    ["boom", "UNKNOWN"],
  ] as const)("%s → code %s", (message, code) => {
    expect(toNativePasskeyError(new Error(message)).code).toBe(code)
  })

  it("pesan mentah SDK tidak pernah bocor ke layar", () => {
    const err = toNativePasskeyError(
      new Error("ASAuthorizationError domain=1000 code=1001 request canceled"),
    ) as InstanceType<typeof PasskeyError>
    expect(err.message).not.toContain("ASAuthorizationError")
    expect(err.message).not.toContain("domain=1000")
    expect(err.message.length).toBeGreaterThan(15)
  })

  it("PasskeyError yang sudah dipetakan diteruskan apa adanya", () => {
    const original = new PasskeyError("SECURITY", "Origin tidak sesuai.")
    expect(toNativePasskeyError(original)).toBe(original)
  })
})
