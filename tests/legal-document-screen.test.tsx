/**
 * Layar dokumen legal native (2026-09-28): konten S&K & Kebijakan Privasi
 * dari draf v1.0 dirender penuh di aplikasi memakai design system.
 *
 * 1. Integritas konten: jumlah part/pasal, tanpa pasal kosong, id unik,
 *    tanpa segmen teks kosong, catatan internal tidak ikut.
 * 2. Render: hero, daftar isi, pasal pertama, ringkasan (privacy), FAB TOC.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { LegalDocumentScreen } from "@/components/legal-document-screen"
import { PRIVACY_CONTENT, type LegalDocData } from "@/lib/legal/privacy-content"
import { TERMS_CONTENT } from "@/lib/legal/terms-content"

afterEach(cleanup)

function checkIntegrity(doc: LegalDocData) {
  const ids = new Set<string>()
  let sections = 0
  for (const part of doc.parts) {
    expect(part.id.length).toBeGreaterThan(0)
    for (const s of part.sections) {
      sections += 1
      expect(s.paragraphs.length, `pasal kosong: ${s.id}`).toBeGreaterThan(0)
      expect(ids.has(s.id), `id ganda: ${s.id}`).toBe(false)
      ids.add(s.id)
      for (const p of s.paragraphs)
        for (const seg of p.segments)
          expect(seg.text.trim().length, `segmen kosong di ${s.id}`).toBeGreaterThan(0)
    }
  }
  // Catatan internal pra-publikasi tidak boleh lolos ke aplikasi.
  const allText = JSON.stringify(doc).toLowerCase()
  expect(allText).not.toContain("catatan penerapan")
  expect(allText).not.toContain("penelaahan internal")
  return sections
}

describe("integritas konten legal", () => {
  it("S&K: 6 part, 70 pasal, intro 2, tanpa ringkasan", () => {
    expect(TERMS_CONTENT.parts.length).toBe(6)
    expect(checkIntegrity(TERMS_CONTENT)).toBe(70)
    expect(TERMS_CONTENT.intro.length).toBe(2)
    expect(TERMS_CONTENT.summary).toBeNull()
    expect(TERMS_CONTENT.parts[0].title).toContain("BAGIAN I")
    // Bagian II (privasi) tidak duplikat di layar S&K.
    expect(TERMS_CONTENT.parts.some((p) => p.title.includes("BAGIAN II"))).toBe(false)
  })

  it("Privasi: 9 part, 85 pasal, intro 3, ringkasan 6 paragraf", () => {
    expect(PRIVACY_CONTENT.parts.length).toBe(9)
    expect(checkIntegrity(PRIVACY_CONTENT)).toBe(85)
    expect(PRIVACY_CONTENT.intro.length).toBe(3)
    expect(PRIVACY_CONTENT.summary?.paragraphs.length).toBe(6)
  })
})

function renderScreen(kind: "terms" | "privacy") {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <LegalDocumentScreen kind={kind} />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

describe("render LegalDocumentScreen", () => {
  it("S&K: hero + daftar isi + pasal pertama", () => {
    renderScreen("terms")
    // Judul muncul di Header dan hero.
    expect(screen.getAllByText("Syarat & Ketentuan").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Daftar Isi")).toBeTruthy()
    // Judul pasal muncul di TOC dan di isi.
    expect(
      screen.getAllByText("1. Ruang lingkup dan keberlakuan").length,
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Versi 1.0")).toBeTruthy()
    // FAB daftar isi ada.
    expect(
      screen.getByRole("button", { name: "Buka daftar isi" }),
    ).toBeTruthy()
  })

  it("Privasi: ringkasan utama tampil sebagai kartu sorot", () => {
    renderScreen("privacy")
    expect(screen.getAllByText("Kebijakan Privasi").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Ringkasan Utama")).toBeTruthy()
    expect(
      screen.getAllByText("1. RUANG LINGKUP KEBIJAKAN").length,
    ).toBeGreaterThanOrEqual(2)
  })

  it("FAB membuka bottom sheet daftar isi", () => {
    renderScreen("terms")
    fireEvent.click(screen.getByRole("button", { name: "Buka daftar isi" }))
    expect(screen.getByText("Ketuk untuk lompat ke bagian")).toBeTruthy()
  })
})
