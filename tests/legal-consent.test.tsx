/**
 * <LegalConsent> — satu baris persetujuan (overhaul auth 2026-10-10, bagian 4).
 *
 * Yang dijaga test ini bukan "ada teks persetujuan", melainkan tiga hal yang
 * mudah rusak diam-diam:
 *   1. Kalimatnya SATU kunci i18n bertoken {x}/{y} yang dipecah kembali
 *      menjadi dua <TextLink>. Kalau suatu saat penulis menggantinya dengan
 *      fragmen per kata, konektor "serta"/"dan" jatuh ke `isTechnical` di
 *      gen-i18n-catalog dan tidak akan pernah bisa diterjemahkan — pengguna
 *      English melihat kalimat campur dua bahasa. Test bahasa Inggris di sini
 *      gagal keras bila itu terjadi.
 *   2. Penanda slot (`@@terms@@`) tidak pernah bocor ke layar.
 *   3. Tautannya membuka dokumen in-app (ROUTES.terms / ROUTES.privacyPolicy),
 *      bukan browser di tengah alur masuk.
 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { router as routerStub } from "expo-router"

import { LegalConsent } from "@/components/auth/legal-consent"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"
// FE-072: kamus English dimuat lazy di produksi — test mengimpor langsung agar
// terjemahan tersedia sinkron sebelum render.
import "@/lib/i18n/en"

afterEach(() => {
  cleanup()
  act(() => applyLanguage("id"))
  clearTranslationCache()
  vi.restoreAllMocks()
})

function renderConsent(action: "signIn" | "signUp" | "continue" = "signIn") {
  return render(<LegalConsent action={action} />)
}

describe("<LegalConsent>", () => {
  it("bahasa sumber: satu kalimat utuh, dua tautan dokumen, tanpa penanda slot", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    const { container } = renderConsent("signIn")

    expect(container.textContent).toBe(
      "Dengan masuk, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi",
    )
    expect(container.textContent).not.toContain("@@")
    expect(screen.getByRole("link", { name: "Syarat & Ketentuan" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Kebijakan Privasi" })).toBeTruthy()
  })

  it("English: seluruh kalimat — termasuk konektornya — ikut terjemah", () => {
    act(() => applyLanguage("en"))
    clearTranslationCache()
    const { container } = renderConsent("signIn")

    expect(container.textContent).toBe(
      "By signing in, you agree to the Terms & Conditions and the Privacy Policy",
    )
    // Sisa bahasa Indonesia di tengah kalimat = fragmen yang tidak terkatalog.
    expect(container.textContent).not.toMatch(/menyetujui|serta/)
    expect(container.textContent).not.toContain("@@")
  })

  it("action=signUp tidak mengklaim persetujuan untuk 'masuk'", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    const { container } = renderConsent("signUp")

    expect(container.textContent).toContain("Dengan membuat akun, Anda menyetujui")
    expect(container.textContent).not.toContain("Dengan masuk")
  })

  it("tautan membuka dokumen in-app, bukan browser", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    const push = vi.spyOn(routerStub, "push")
    renderConsent("signIn")

    fireEvent.click(screen.getByRole("link", { name: "Syarat & Ketentuan" }))
    expect(push).toHaveBeenLastCalledWith("/terms")

    fireEvent.click(screen.getByRole("link", { name: "Kebijakan Privasi" }))
    expect(push).toHaveBeenLastCalledWith("/privacy-policy")
  })

  it("tetap satu baris kecil — tidak ada paragraf disclaimer yang ikut dirender", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    const { container } = renderConsent("signIn")

    // Disclaimer lama yang dihapus di bagian 4 tidak boleh muncul lagi lewat
    // komponen mana pun yang merender baris ini.
    expect(container.textContent).not.toContain("lokasi perangkat")
    expect(container.textContent).not.toContain("WhatsApp")
    expect(container.querySelectorAll("p")).toHaveLength(0)
  })
})
