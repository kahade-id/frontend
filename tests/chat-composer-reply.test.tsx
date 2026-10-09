/**
 * Temuan #10 — UI balas di <ChatComposer>.
 *
 * Kutipan balasan HARUS berada DI DALAM pil input kaca (satu objek yang
 * membesar & terangkat), bukan kartu terpisah yang melayang di atasnya.
 * Dulu keduanya sederajat di bawah root: pil dan kutipan是两个 kartu
 * berurutan, sehingga yang terlihat adalah "kutipan menempel di atas input".
 *
 * Objek testnya adalah STRUKTUR (siapa wadah siapa), karena perbedaan
 * visualnya murni penempatan — diukur lewat leluhur bersama terdekat
 * (lowest common ancestor) antara teks kutipan dan kolom ketik.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatComposer } from "@/components/ui/chat-composer"

afterEach(cleanup)

function inTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

const base = {
  value: "",
  onChangeText: () => undefined,
  onSend: () => undefined,
  onMicPress: () => undefined,
}

const replyTo = { id: "m1", senderName: "Budi", preview: "Besok jam tujuh ya" }

/** Leluhur bersama TERDEKAT dari dua elemen DOM. */
function lowestCommonAncestor(a: Element, b: Element): Element | null {
  const chainA = new Set<Element>()
  for (let node: Element | null = a; node; node = node.parentElement) chainA.add(node)
  for (let node: Element | null = b; node; node = node.parentElement) {
    if (chainA.has(node)) return node
  }
  return null
}

describe("<ChatComposer> kutipan balasan", () => {
  it("kutipan dan kolom ketik berada di SATU wadah (pil input), bukan sederajat di root", () => {
    inTheme(<ChatComposer {...base} replyTo={replyTo} onCancelReply={() => undefined} />)

    const root = screen.getByRole("toolbar")
    const input = screen.getByRole("textbox")
    const quote = screen.getByText("Besok jam tujuh ya")

    const box = lowestCommonAncestor(quote, input)
    expect(box).not.toBeNull()
    // Wadahnya BUKAN root (kalau iya, kutipan masih melayang di atas input).
    expect(box).not.toBe(root)
    expect(root.contains(box as Element)).toBe(true)
    // Dan wadah itu memuat keduanya.
    expect((box as Element).contains(input)).toBe(true)
    expect((box as Element).contains(quote)).toBe(true)
  })

  it("menampilkan siapa yang dibalas + tombol batal balas", () => {
    const onCancelReply = vi.fn()
    inTheme(<ChatComposer {...base} replyTo={replyTo} onCancelReply={onCancelReply} />)

    expect(screen.getByText(/Budi/)).toBeTruthy()
    expect(screen.getByLabelText("Batalkan balasan")).toBeTruthy()
  })

  it("tanpa balasan: tidak ada kutipan sama sekali", () => {
    inTheme(<ChatComposer {...base} />)
    expect(screen.queryByText("Besok jam tujuh ya")).toBeNull()
    expect(screen.queryByLabelText("Batalkan balasan")).toBeNull()
    // Kolom ketik tetap ada.
    expect(screen.getByRole("textbox")).toBeTruthy()
  })
})
