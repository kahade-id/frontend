/**
 * <ChatRoomListItem> — preview & lencana verifikasi (permintaan produk
 * 2026-10-08).
 *
 *  a. Pesan terakhir dari kita sendiri TIDAK menulis "Anda:" — penandanya
 *     hanya centang status di depan isi preview.
 *  b. Lampiran tanpa teks menampilkan IKON jenisnya (gambar/video/suara/
 *     berkas) + label jenis, bukan "(lampiran)".
 *  c. Lencana verifikasi tampil di SAMPING NAMA, tidak lagi menempel di
 *     foto profil (overlay avatar dihapus).
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"

afterEach(cleanup)

function renderInTheme(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

describe("<ChatRoomListItem>: preview pesan terakhir", () => {
  it("(a) pesan sendiri TANPA prefix 'Anda:' — cukup centang di depan preview", () => {
    const { container } = renderInTheme(
      <ChatRoomListItem
        name="Agung Kurniawan"
        lastMessage={{ text: "Barang sudah dikirim", fromSelf: true, status: "read" }}
        time="14:32"
      />,
    )
    expect(screen.getByText("Barang sudah dikirim")).toBeTruthy()
    expect(container.textContent).not.toContain("Anda:")
    // Centang ganda "dibaca" menyertai preview.
    expect(container.querySelectorAll('[data-icon="Checks"]').length).toBe(1)
  })

  it("(b) lampiran gambar → ikon jenis + label 'Foto'", () => {
    const { container } = renderInTheme(
      <ChatRoomListItem name="Toko Maju" lastMessage={{ text: "", kind: "image" }} time="09:10" />,
    )
    expect(screen.getByText("Foto")).toBeTruthy()
    expect(container.querySelectorAll('[data-icon="Image"]').length).toBe(1)
  })

  it("(b) lampiran berkas → ikon dokumen + label 'Dokumen'", () => {
    const { container } = renderInTheme(
      <ChatRoomListItem name="Toko Maju" lastMessage={{ text: "", kind: "file" }} time="09:10" />,
    )
    expect(screen.getByText("Dokumen")).toBeTruthy()
    expect(container.querySelectorAll('[data-icon="FileText"]').length).toBe(1)
  })

  it("(b) lampiran video & suara memakai ikonnya masing-masing", () => {
    const video = renderInTheme(
      <ChatRoomListItem name="Toko Maju" lastMessage={{ text: "", kind: "video" }} />,
    )
    expect(video.container.querySelectorAll('[data-icon="VideoCamera"]').length).toBe(1)
    cleanup()
    const voice = renderInTheme(
      <ChatRoomListItem name="Toko Maju" lastMessage={{ text: "", kind: "voice" }} />,
    )
    expect(voice.container.querySelectorAll('[data-icon="Microphone"]').length).toBe(1)
  })

  it("teks biasa tanpa lampiran → tanpa ikon jenis", () => {
    const { container } = renderInTheme(
      <ChatRoomListItem name="Toko Maju" lastMessage={{ text: "Halo, ready?" }} />,
    )
    expect(screen.getByText("Halo, ready?")).toBeTruthy()
    for (const icon of ["Image", "VideoCamera", "Microphone", "FileText"]) {
      expect(container.querySelectorAll(`[data-icon="${icon}"]`).length).toBe(0)
    }
  })
})

describe("<ChatRoomListItem>: lencana verifikasi", () => {
  it("(c) seal di samping nama, BUKAN overlay di foto profil", () => {
    const { container } = renderInTheme(
      <ChatRoomListItem name="Agung Kurniawan" verified sealTier="blue" lastMessage={{ text: "Halo" }} />,
    )
    // Overlay badge di Avatar memakai testID ini — harus tidak ada.
    expect(container.querySelector('[data-testid="avatar-verified-badge"]')).toBeNull()
    // Tepat satu seal: di samping nama.
    expect(container.querySelectorAll('[data-icon="SealCheck"]').length).toBe(1)
    expect(screen.getByText("Agung Kurniawan")).toBeTruthy()
  })

  it("tanpa verifikasi → tanpa seal sama sekali", () => {
    const { container } = renderInTheme(<ChatRoomListItem name="Budi" lastMessage={{ text: "Halo" }} />)
    expect(container.querySelectorAll('[data-icon="SealCheck"]').length).toBe(0)
  })
})
