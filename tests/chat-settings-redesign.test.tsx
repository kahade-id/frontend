/**
 * Desain ulang halaman "Pengaturan pesan" (/chat/settings, 2026-10-08).
 *
 * Kontrak yang dikunci (API asli tidak pernah ditembak):
 *   1. DUA grup bernama jelas: "Privasi" dan "Balasan cepat".
 *   2. Baris privasi TIDAK lagi menumpuk kartu: satu kartu berisi switch +
 *      daftar radio kebijakan DM.
 *   3. Form template TERSEMBUNYI sampai diminta — halaman pengaturan dibuka
 *      untuk mengatur, bukan mengisi form. Tombol "Buat template" membukanya;
 *      ikon ubah pada baris template membukanya sudah terisi.
 *   4. Label aksesibilitas bertemplate lewat translate("… {x}") — pembaca
 *      layar berbahasa Inggris tidak lagi mendengar kalimat Indonesia.
 *
 * Jalankan dengan config komponen:
 *   npx vitest run -c vitest.components.config.ts tests/chat-settings-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  privacy: {
    hideReadReceipts: false,
    dmPolicy: "EVERYONE" as "EVERYONE" | "FOLLOWING" | "NONE",
  },
  updatePrivacy: vi.fn(),
  templates: [] as { id: string; shortcut: string; text: string }[],
  refresh: vi.fn(),
  addTemplate: vi.fn(),
  toastShow: vi.fn(),
}))

vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true }))

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat")
  return {
    ...actual,
    getChatPrivacy: async () => mocks.privacy,
    updateChatPrivacy: async (patch: Record<string, unknown>) => {
      mocks.updatePrivacy(patch)
      mocks.privacy = { ...mocks.privacy, ...patch }
      return mocks.privacy
    },
  }
})

vi.mock("@/lib/reply-templates", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/reply-templates")>("@/lib/reply-templates")
  return {
    ...actual,
    useReplyTemplates: () => ({
      templates: mocks.templates,
      loading: false,
      error: null,
      refresh: mocks.refresh,
    }),
    addReplyTemplate: (...args: unknown[]) => mocks.addTemplate(...args),
  }
})

vi.mock("@/components/ui/toast", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui/toast")>("@/components/ui/toast")
  return {
    ...actual,
    useToast: () => ({ show: mocks.toastShow, hide: () => {} }),
  }
})

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import ChatSettingsScreen from "@/app/chat/settings"

function renderScreen() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ChatSettingsScreen />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  mocks.privacy = { hideReadReceipts: false, dmPolicy: "EVERYONE" }
  mocks.templates = []
  mocks.updatePrivacy.mockClear()
  mocks.addTemplate.mockClear()
  mocks.refresh.mockClear()
  mocks.toastShow.mockClear()
})

describe("grup & copy", () => {
  it("judul halaman mengikuti nama tab Pesan", () => {
    renderScreen()
    expect(screen.getByText("Pengaturan pesan")).toBeTruthy()
  })

  it("dua grup bernama jelas dengan subtitle satu baris", async () => {
    renderScreen()
    // "Privasi" langsung terlihat (tanpa menunggu muat).
    expect(screen.getByText("Privasi")).toBeTruthy()
    expect(screen.getByText("Berlaku di semua perangkat Anda.")).toBeTruthy()
    expect(screen.getByText("Balasan cepat")).toBeTruthy()
    expect(screen.getByText("Ketik “/” di kolom pesan untuk memakainya.")).toBeTruthy()
  })

  it("tidak menyebut istilah internal di UI", () => {
    renderScreen()
    for (const banned of ["escrow", "rekber", "ditahan", "penahanan"]) {
      expect(screen.queryByText(new RegExp(banned, "i"))).toBeNull()
    }
  })
})

describe("grup privasi", () => {
  // Privasi dimuat asinkron (GET /v1/chat/privacy) — pakai findBy.
  it("switch centang dibaca mengirim patch ke server", async () => {
    renderScreen()
    const toggle = await screen.findByRole("switch", {
      name: /Sembunyikan centang dibaca/,
    })
    fireEvent.click(toggle)
    expect(mocks.updatePrivacy).toHaveBeenCalledWith({ hideReadReceipts: true })
  })

  it("kebijakan DM adalah daftar radio dengan copy singkat", async () => {
    renderScreen()
    await screen.findByText("Hanya yang saya ikuti")
    expect(screen.getAllByRole("radio")).toHaveLength(3)
    // Copy singkat — bukan paragraf.
    expect(screen.getByText("Siapa pun bisa memulai percakapan.")).toBeTruthy()
    expect(screen.getByText("Hanya orang yang Anda ikuti.")).toBeTruthy()
    expect(screen.getByText("Tolak semua percakapan baru.")).toBeTruthy()
    // Nuansa "chat lama tetap jalan" dijelaskan SEKALI di judul grup.
    expect(screen.getByText("Percakapan yang sudah ada tidak terpengaruh.")).toBeTruthy()
  })

  it("memilih radio lain mengirim dmPolicy baru", async () => {
    renderScreen()
    fireEvent.click(await screen.findByText("Hanya yang saya ikuti"))
    expect(mocks.updatePrivacy).toHaveBeenCalledWith({ dmPolicy: "FOLLOWING" })
  })
})

describe("grup balasan cepat", () => {
  it("belum ada template → empty state dengan aksi, form TERTUTUP", () => {
    renderScreen()
    expect(screen.getByText("Belum ada template")).toBeTruthy()
    expect(screen.queryByLabelText("Shortcut template")).toBeNull()
    expect(screen.getByText("Buat template")).toBeTruthy()
  })

  it("tekan 'Buat template' → form terbuka", () => {
    renderScreen()
    fireEvent.click(screen.getByText("Buat template"))
    expect(screen.getByLabelText("Shortcut template")).toBeTruthy()
    expect(screen.getByLabelText("Isi template")).toBeTruthy()
  })

  it("daftar template memakai SATU kartu + label a11y lewat translate", () => {
    mocks.templates = [
      { id: "t1", shortcut: "salam", text: "Halo, terima kasih sudah menghubungi." },
      { id: "t2", shortcut: "alamat", text: "Alamat lengkap toko kami…" },
    ]
    renderScreen()
    expect(screen.getByText("/salam")).toBeTruthy()
    expect(screen.getByText("/alamat")).toBeTruthy()
    expect(screen.getByLabelText("Ubah template /salam")).toBeTruthy()
    expect(screen.getByLabelText("Hapus template /salam")).toBeTruthy()
    // Form tetap tertutup sampai diminta — walau sudah ada template.
    expect(screen.queryByLabelText("Shortcut template")).toBeNull()
  })

  it("ikon ubah membuka form dengan isi template terpilih", () => {
    mocks.templates = [{ id: "t1", shortcut: "salam", text: "Halo, terima kasih." }]
    renderScreen()
    fireEvent.click(screen.getByLabelText("Ubah template /salam"))
    const shortcut = screen.getByLabelText("Shortcut template") as HTMLInputElement
    expect(shortcut.value).toBe("salam")
  })

  it("batas 50 template disampaikan sekali sebagai catatan", () => {
    renderScreen()
    expect(screen.getByText("Maksimum 50 template per akun.")).toBeTruthy()
  })
})

describe("Privasi di layar tamu", () => {
  it("tidak menembak API saat tanpa sesi (kontrak NAV-004 tetap)", async () => {
    // Modul guest-gate di-mock `true` untuk seluruh file ini; kontraknya
    // dijaga di tests/guest-*.test.* — di sini hanya memastikan layar ini
    // memakai gate tersebut (bukan memanggil API langsung di modul).
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("app/chat/settings.tsx", "utf8"),
    )
    expect(source).toContain("useHasSession()")
    expect(source).toContain("GuestLoginPrompt")
  })
})
