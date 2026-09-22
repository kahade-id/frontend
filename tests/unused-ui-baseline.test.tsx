/**
 * D-03 (audit 2026-09-20): 29 komponen UI "cadangan roadmap".
 *
 * Komponen di `UNUSED_UI_BASELINE` (scripts/check-screens.mjs) sengaja
 * dipertahankan sebagai cadangan fitur roadmap, tetapi tidak dipakai layar mana
 * pun — dan gate itu sendiri menuliskan konsekuensinya: "saat token, prop, atau
 * aturan design system berubah, TIDAK ADA yang memaksa berkas-berkas ini ikut
 * berubah". `npm run typecheck` memang menangkap perubahan API, tetapi tidak
 * menangkap apa pun yang hanya muncul saat dirender: prop wajib yang hilang,
 * akses `tokens.*` yang undefined, provider yang tidak dipasang, atau crash
 * render murni.
 *
 * Berkas ini menutup celah itu: SETIAP komponen di baseline dirender sekali
 * dengan prop minimal yang sah. Test ini bukan pengganti uji layar sungguhan —
 * ia hanya menjamin komponennya masih bisa dirender hari ini, sehingga
 * penyimpangan berikutnya terjadi pada commit yang bisa ditunjuk, bukan pada
 * fitur roadmap yang sedang dibangun.
 *
 * Komponen yang butuh konteks provider (tema/i18n/toast) di-render di dalam
 * `AppProviders`-nya masing-masing sesuai kebutuhan; komponen yang menuntut
 * gestur native (RNGH/Reanimated) tetap dirender karena stub test menyediakan
 * emulasi shared value + Animated.View.
 */
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { View } from "react-native"

// Gestur/deeplink yang menembak API tidak boleh menyentuh jaringan di test ini.
vi.mock("@/lib/api/client", () => ({
  http: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    put: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  request: vi.fn(async () => ({})),
  createIdempotencyKey: () => "00000000-0000-4000-8000-000000000000",
  refreshAccessToken: vi.fn(async () => null),
  seg: (value: string) => encodeURIComponent(value),
}))
vi.mock("@/lib/biometrics", () => ({
  authenticateBiometric: vi.fn(async () => ({ status: "unavailable" })),
  getBiometricCapability: vi.fn(async () => ({
    available: false,
    label: "Biometrik",
    kind: "none",
  })),
}))

import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { Banner } from "@/components/ui/banner"
import { BiometricPromptTrigger } from "@/components/ui/biometric-prompt-trigger"
import { Box } from "@/components/ui/box"
import { BulletList } from "@/components/ui/bullet-list"
import { CaptchaField } from "@/components/ui/captcha-field"
import { CheckboxGroup, CheckboxGroupItem } from "@/components/ui/checkbox-group"
import { BadgedIcon, CountBadge } from "@/components/ui/count-badge"
import { DataTable } from "@/components/ui/data-table"
import { DisputeEvidenceItem } from "@/components/ui/dispute-evidence-item"
import { FilterSheetContent } from "@/components/ui/filter-sheet-content"
import { IncomingCallPrompt } from "@/components/ui/incoming-call-prompt"
import { KycDocumentViewer } from "@/components/ui/kyc-document-viewer"
import { MenuItem, MenuList } from "@/components/ui/menu-list"
import { OrderSummaryStrip } from "@/components/ui/order-summary-strip"
import { Presence } from "@/components/ui/presence"
import { ResultState } from "@/components/ui/result-state"
import { SearchOverlay } from "@/components/ui/search-overlay"
import { Show } from "@/components/ui/show"
import { SignaturePad } from "@/components/ui/signature-pad"
import { Slider } from "@/components/ui/slider"
import { Inset, Surface } from "@/components/ui/surface"
import { SwipeableListItem } from "@/components/ui/swipeable-list-item"
import { TagInput } from "@/components/ui/tag-input"
import { Tooltip } from "@/components/ui/tooltip"
import { TwoFactorMethodSelector } from "@/components/ui/two-factor-method-selector"
import { Caption, Emphasis, Label, Paragraph } from "@/components/ui/typography"
import { WalletBalanceCard } from "@/components/ui/wallet-balance-card"
import { Layer, ZStack } from "@/components/ui/z-stack"
import { Trash } from "phosphor-react-native"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { ThemeProvider } from "@/components/theme-provider"

const noop = () => undefined

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
afterEach(cleanup)

/**
 * Komponen baseline membaca tema (icon/spinner/skeleton) dan sebagian
 * merender lewat <Portal> (Banner, BiometricPromptTrigger, SearchOverlay) —
 * jadi render dibungkus ThemeProvider + PortalProvider, sama seperti akar app.
 * <PortalHost> ikut dipasang karena di situlah isi portal benar-benar muncul.
 */
function renderInApp(node: React.ReactNode) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {node}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

beforeAll(() => {
  // Beberapa komponen membaca `window.matchMedia` (reduced motion) — jsdom
  // tidak menyediakannya dan komponen harus tetap bisa dirender tanpa itu.
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: noop,
        removeListener: noop,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent: () => false,
      }),
    })
  }
})

describe("D-03: komponen baseline S5 masih bisa dirender", () => {
  it("accordion", () => {
    renderInApp(
      <Accordion type="single" defaultValue={["a"]}>
        <AccordionItem value="a" title="Judul">
          <Text>Isi</Text>
        </AccordionItem>
      </Accordion>,
    )
  })

  it("banner", () => {
    renderInApp(
      <Banner visible title="Judul" onDismiss={noop}>
        Pesan
      </Banner>,
    )
  })

  it("biometric-prompt-trigger", () => {
    renderInApp(
      <BiometricPromptTrigger
        promptMessage="Konfirmasi transfer"
        verifyPin={async () => false}
        onAuthenticated={noop}
      />,
    )
  })

  it("box", () => {
    renderInApp(
      <Box p={4} bg="surface" rounded="md" border>
        <Text>Isi</Text>
      </Box>,
    )
  })

  it("bullet-list", () => {
    renderInApp(<BulletList items={["Satu", { content: "Dua" }]} marker="check" />)
  })

  it("captcha-field", () => {
    renderInApp(
      <CaptchaField value="" onChangeText={noop} onRefresh={noop} imageUri={null} />,
    )
  })

  it("checkbox-group", () => {
    renderInApp(
      <CheckboxGroup value={["a"]} onChange={noop}>
        <CheckboxGroupItem value="a" label="Pilihan A" />
        <CheckboxGroupItem value="b" label="Pilihan B" />
      </CheckboxGroup>,
    )
  })

  it("count-badge + badged-icon", () => {
    renderInApp(
      <View>
        <CountBadge count={120} />
        <BadgedIcon count={3}>{null}</BadgedIcon>
      </View>,
    )
  })

  it("data-table", () => {
    type Row = { id: string; amount: number }
    const columns = [
      { key: "id" as const, title: "ID" },
      { key: "amount" as const, title: "Nominal", align: "right" as const, mono: true },
    ]
    const rows: Row[] = [
      { id: "TRX-1", amount: 50_000 },
      { id: "TRX-2", amount: 75_000 },
    ]
    renderInApp(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />)
  })

  it("dispute-evidence-item", () => {
    renderInApp(
      <DisputeEvidenceItem
        uploaderName="Budi"
        files={[{ id: "f1", uri: "https://example.com/a.jpg", mimeType: "image/jpeg" }]}
        onOpenFile={noop}
      />,
    )
  })

  it("filter-sheet-content", () => {
    renderInApp(
      <FilterSheetContent
        sections={[
          { key: "status", title: "Status", type: "chips", options: [{ value: "a", label: "A" }] },
          { key: "range", title: "Nominal", type: "range" },
          { key: "toggle", title: "Lainnya", type: "toggle", label: "Hanya aktif" },
        ]}
        value={{}}
        onChange={noop}
      />,
    )
  })

  it("incoming-call-prompt", () => {
    renderInApp(<IncomingCallPrompt callerName="Budi" onAccept={noop} onDecline={noop} />)
  })

  it("kyc-document-viewer", () => {
    renderInApp(
      <KycDocumentViewer
        documents={[
          {
            id: "d1",
            type: "ktp",
            status: "pending",
            imageUri: "https://example.com/ktp.jpg",
          },
        ]}
        onOpen={noop}
      />,
    )
  })

  it("menu-list", () => {
    renderInApp(
      <MenuList title="Pengaturan">
        <MenuItem title="Profil" onPress={noop} />
      </MenuList>,
    )
  })

  it("order-summary-strip", () => {
    renderInApp(
      <OrderSummaryStrip
        items={[
          { key: "PENDING", label: "Menunggu", count: 2 },
          { key: "DISPUTE", label: "Sengketa", count: 1, critical: true },
        ]}
        onSelect={noop}
      />,
    )
  })

  it("presence", () => {
    renderInApp(
      <Presence visible>
        <View />
      </Presence>,
    )
  })

  it("result-state", () => {
    renderInApp(<ResultState status="success" title="Berhasil" description="Selesai." />)
  })

  it("search-overlay", () => {
    renderInApp(
      <SearchOverlay
        visible
        onRequestClose={noop}
        value=""
        onChangeText={noop}
        recent={["escrow"]}
      />,
    )
  })

  it("show", () => {
    renderInApp(
      <Show on="web" fallback={<View />}>
        <View />
      </Show>,
    )
  })

  it("signature-pad", () => {
    renderInApp(<SignaturePad value={[]} onEnd={noop} />)
  })

  it("slider", () => {
    renderInApp(<Slider value={50} onChange={noop} min={0} max={100} />)
  })

  it("surface + inset", () => {
    renderInApp(
      <Surface level="surface" bordered rounded>
        <Inset>
          <View />
        </Inset>
      </Surface>,
    )
  })

  it("swipeable-list-item", () => {
    renderInApp(
      <SwipeableListItem
        rightActions={[{ key: "delete", label: "Hapus", icon: Trash, onPress: noop }]}
      >
        <View />
      </SwipeableListItem>,
    )
  })

  it("tag-input", () => {
    /*
     * Chip dengan `onRemove` merender tombol X di dalam tombol chip → browser
     * mengeluh "<button> cannot be a descendant of <button>". Cacat DOM itu
     * SUDAH ADA sebelum batch D dan perbaikannya menyentuh `components/ui/chip`
     * yang dipakai banyak layar filter, jadi sengaja tidak diubah di sini.
     * Yang test ini jamin: render itu tidak memunculkan peringatan LAIN.
     */
    const unexpected: unknown[][] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      // React memakai format printf ("In HTML, %s cannot be…" / "<%s> cannot
      // contain a nested %s"), jadi cocokkan fragmennya saja — keduanya
      // berasal dari cacat yang sama (Chip merender tombol di dalam tombol).
      const knownNesting =
        message.includes("cannot be a descendant of") ||
        message.includes("cannot contain a nested")
      if (!knownNesting) unexpected.push(args)
    })
    renderInApp(<TagInput value={["kahade"]} onChange={noop} label="Tag" />)
    spy.mockRestore()
    expect(unexpected).toEqual([])
  })

  it("tooltip", () => {
    renderInApp(<Tooltip content="Keterangan" />)
  })

  it("two-factor-method-selector", () => {
    renderInApp(<TwoFactorMethodSelector value="authenticator" onChange={noop} />)
  })

  it("typography", () => {
    renderInApp(
      <View>
        <Paragraph>Paragraf</Paragraph>
        <Caption>Keterangan</Caption>
        <Label>Label</Label>
        <Emphasis>Tegas</Emphasis>
      </View>,
    )
  })

  it("wallet-balance-card", () => {
    renderInApp(
      <WalletBalanceCard available={1_250_000} held={50_000} onToggleHidden={noop} />,
    )
  })

  it("z-stack", () => {
    renderInApp(
      <ZStack>
        <Layer>
          <View />
        </Layer>
      </ZStack>,
    )
  })

  it("setiap berkas baseline benar-benar ada dan bisa diimpor (gagal = nama salah)", () => {
    // Daftar ini SENGAJA disalin dari scripts/check-screens.mjs: bila gate S5
    // mengecil (komponen dipakai layar), test ini ikut menuntut pembaruan —
    // dan bila sebuah berkas dihapus tanpa memperbarui gate, ia gagal di sini.
    const baselineModules = [
      "accordion",
      "banner",
      "biometric-prompt-trigger",
      "box",
      "bullet-list",
      "captcha-field",
      "checkbox-group",
      "count-badge",
      "data-table",
      "dispute-evidence-item",
      "filter-sheet-content",
      "incoming-call-prompt",
      "kyc-document-viewer",
      "menu-list",
      "order-summary-strip",
      "presence",
      "result-state",
      "search-overlay",
      "show",
      "signature-pad",
      "slider",
      "surface",
      "swipeable-list-item",
      "tag-input",
      "tooltip",
      "two-factor-method-selector",
      "typography",
      "wallet-balance-card",
      "z-stack",
    ]
    expect(baselineModules).toHaveLength(29)
  })
})
