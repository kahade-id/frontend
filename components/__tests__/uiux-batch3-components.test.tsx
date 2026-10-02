import { useState, type ReactElement, type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  dataSaver: false,
  wifi: true,
  hasSession: false,
  ratings: vi.fn(),
  follow: vi.fn(),
  toast: { show: vi.fn() },
  push: vi.fn(),
}))

vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<Record<string, unknown>>("@/lib/api/errors"),
  api: { showcase: { reportShowcase: vi.fn() } },
  createIdempotencyKey: () => "test-report-key",
}))
vi.mock("@/lib/api/ratings", () => ({ getPublicRatingSummary: state.ratings }))
vi.mock("@/lib/ui-prefs", () => ({ useDataSaver: () => state.dataSaver }))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => state.hasSession, useSessionRevision: () => 0 }))
vi.mock("@/lib/entity-detail-prefetch", () => ({ prefetchUserProfile: vi.fn() }))
vi.mock("@/lib/prefetch-neighbors", () => ({ prefetchNeighborImages: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => state.toast }))
vi.mock("@/lib/use-showcase-author-follow", () => ({ useShowcaseAuthorFollow: () => ({ following: false, loading: false, onToggle: state.follow }) }))
vi.mock("@/components/ui/feed-video", () => ({
  FeedVideo: ({ shouldPlay, muted, allowTapToggle }: { shouldPlay: boolean; muted: boolean; allowTapToggle?: boolean }) => <div data-testid="video" data-playing={String(shouldPlay)} data-muted={String(muted)} data-toggle={String(allowTapToggle)} />,
  useWifiAutoplayAllowed: () => state.wifi,
}))
vi.mock("@/components/ui/zoomable-image", () => ({ ZoomableImage: () => <div data-testid="zoomable" /> }))
vi.mock("@/components/ui/picture", () => ({ Picture: () => <div data-testid="picture" /> }))
vi.mock("@/components/showcase/product-commerce-section", () => ({ CommerceBadgesCompact: () => null }))
vi.mock("@/components/ui/keyboard-avoiding", () => ({ KeyboardAvoiding: ({ children }: { children: ReactNode }) => <div data-testid="keyboard-avoiding">{children}</div> }))
vi.mock("expo-router", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  router: { push: state.push },
  useRouter: () => ({ push: state.push }),
}))

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { OrderStatusHero } from "@/components/ui/order-status-hero"
import { ChatOrderCard } from "@/components/ui/chat-cards"
import { ImageViewer } from "@/components/ui/image-viewer"
import type { OpeningMediaTap } from "@/lib/use-opening-media-tap"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseAuthorRow } from "@/components/showcase-author-row"
import { RatingDistributionBars } from "@/components/ui/rating-distribution"
import { CountBadge } from "@/components/ui/count-badge"
import { NotificationCount } from "@/components/ui/badge"
import { Tabs } from "@/components/ui/tabs"
import { visibleTabBarItems, visibleTabBarItemMap } from "@/components/ui/bottom-tab-bar"
import { SHELL_TABS } from "@/lib/shell-tabs"
import { SensitiveConfirmDialog } from "@/components/ui/sensitive-confirm"
import { PasswordField } from "@/components/ui/password-field"
import { OtpInput } from "@/components/ui/otp-input"
import { deviceTimeZoneShort } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import type { GalleryMedia } from "@/lib/showcase-social"

const item = {
  id: "item-123", title: "Desain minimalis", description: "", images: [],
  author: { username: "budi", fullName: "Budi", badges: [] },
  createdAt: "2026-10-02T01:00:00Z", isOwner: false, likeCount: 0, commentCount: 0,
  media: [], categories: [],
} as unknown as ShowcaseSocialItem
const image: GalleryMedia = { id: "image-1", kind: "image", url: "https://example.test/image.jpg" }
const video: GalleryMedia = { id: "video-1", kind: "video", url: "https://example.test/video.mp4", posterUrl: "https://example.test/poster.jpg" }

function themed(ui: ReactElement) {
  return <ThemeProvider><PortalProvider>{ui}<PortalHost /></PortalProvider></ThemeProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  state.dataSaver = false
  state.wifi = true
  state.hasSession = false
  state.ratings.mockResolvedValue({ distribution: { counts: [0, 0, 1, 1, 2], total: 4 }, averageRating: 4.25 })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("A2/A3 — transaction surfaces", () => {
  it("hero labels timestamps with the device zone, not a hardcoded WIB", () => {
    render(themed(<OrderStatusHero status="WAITING_PAYMENT" title="Pesanan" transactionId="ORD-123" createdAt="2026-10-02T01:00:00Z" copied={false} onCopyId={() => {}} />))
    const zone = deviceTimeZoneShort()
    expect(document.body.textContent).toContain(zone)
    if (zone !== "WIB") expect(document.body.textContent).not.toMatch(/\d{2}:\d{2} WIB/)
  })
  it.each([false, true])("chat order snapshot has a readable status (outgoing=%s)", (outgoing) => {
    render(themed(<ChatOrderCard card={{ kind: "ORDER_CARD", buyerUsername: "buyer", sellerUsername: "seller", snapshotAt: "2026-10-02T01:00:00Z", orderId: "ord-123", orderCode: "ORD-123", title: "Pesanan", status: "WAITING_PAYMENT", orderValue: "100000" }} outgoing={outgoing} />))
    expect(screen.getByText("Menunggu pembayaran")).toBeTruthy()
    expect(document.body.textContent).not.toContain("WAITING_PAYMENT")
  })
  it("an unknown order enum is never exposed as raw backend text", () => {
    render(themed(<ChatOrderCard card={{ kind: "ORDER_CARD", buyerUsername: "buyer", sellerUsername: "seller", snapshotAt: "2026-10-02T01:00:00Z", orderId: "ord-123", orderCode: "ORD-123", title: "Pesanan", status: "NEW_BACKEND_STATUS", orderValue: "100000" }} />))
    expect(screen.getByText("Status belum diketahui")).toBeTruthy()
    expect(document.body.textContent).not.toContain("NEW_BACKEND_STATUS")
  })
})

describe("B3/B14 — immediate, consistent media gestures", () => {
  it.each([image, video])("the first %j tap opens immediately even when double-tap like is enabled", (media) => {
    const onOpen = vi.fn(), onDoubleTap = vi.fn()
    render(themed(<ShowcaseMediaGallery media={[media]} title="Media" onOpen={onOpen} onDoubleTap={onDoubleTap} />))
    const target = screen.getByRole("button", { name: media.kind === "image" ? "Lihat foto 1 dari 1" : "Lihat video: Media" })
    fireEvent.click(target)
    expect(onOpen).toHaveBeenCalledTimes(1) // No advanceTimers or 300 ms wait.
    fireEvent.click(target)
    expect(onDoubleTap).toHaveBeenCalledWith(0)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
  it("play, pause, and sound overlays do not open the viewer or like", () => {
    const onOpen = vi.fn(), onDoubleTap = vi.fn()
    render(themed(<ShowcaseMediaGallery media={[video]} title="Media" onOpen={onOpen} onDoubleTap={onDoubleTap} />))
    expect(screen.getByTestId("video").getAttribute("data-playing")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Jeda video: Media" }))
    expect(screen.getByTestId("video").getAttribute("data-playing")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "Putar video: Media" }))
    expect(screen.getByTestId("video").getAttribute("data-playing")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Nyalakan suara video" }))
    expect(screen.getByTestId("video").getAttribute("data-muted")).toBe("false")
    expect(onOpen).not.toHaveBeenCalled()
    expect(onDoubleTap).not.toHaveBeenCalled()
  })
  it("data saver keeps video unmounted until an explicit play-overlay action", () => {
    state.dataSaver = true
    const onOpen = vi.fn()
    render(themed(<ShowcaseMediaGallery media={[video]} title="Media" onOpen={onOpen} />))
    expect(screen.queryByTestId("video")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Lihat video: Media" }))
    expect(onOpen).toHaveBeenCalledWith(0, undefined)
    expect(screen.queryByTestId("video")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Putar video: Media" }))
    expect(screen.getByTestId("video").getAttribute("data-playing")).toBe("true")
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
  it("cellular autoplay does not make the overlay falsely advertise pause", () => {
    state.wifi = false
    render(themed(<ShowcaseMediaGallery media={[video]} title="Media" onOpen={() => {}} />))
    fireEvent.click(screen.getByRole("button", { name: "Putar video: Media" }))
    expect(screen.getByRole("button", { name: "Jeda video: Media" })).toBeTruthy()
  })
})

describe("B4 — guest report sheet", () => {
  it("guests see only a login CTA, never a disabled form", () => {
    const close = vi.fn()
    render(themed(<ShowcaseReportSheet item={item} onRequestClose={close} />))
    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByText("Alasan Laporan")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Masuk untuk melaporkan" }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(state.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/login-required" }))
  })
  it("signed-in users still have the real report form", () => {
    state.hasSession = true
    render(themed(<ShowcaseReportSheet item={item} onRequestClose={() => {}} />))
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0)
    expect(screen.getByRole("textbox")).toBeTruthy()
  })
})

describe("B9/B10 — shared numeric pills and tab metadata", () => {
  it("NotificationCount is the same 18px CountBadge, including capping and empty-state behavior", () => {
    const { rerender } = render(themed(<><CountBadge count={120} /><NotificationCount count={120} /></>))
    expect(screen.getAllByText("99+")).toHaveLength(2)
    rerender(themed(<><CountBadge count={0} /><NotificationCount count={0} /></>))
    expect(screen.queryByText("0")).toBeNull()
    rerender(themed(<CountBadge count={0} showZero />))
    expect(screen.getByText("0")).toBeTruthy()
  })
  it("tab counts preserve zero and exact localized totals via CountBadge", () => {
    render(themed(<Tabs value="one" onChange={() => {}} items={[{ value: "one", label: "Satu", count: 1000 }, { value: "two", label: "Dua", count: 0 }]} />))
    expect(screen.getByText("1.000")).toBeTruthy()
    expect(screen.getByText("0")).toBeTruthy()
  })
  it("both bottom-bar adapters derive all metadata and order from SHELL_TABS", () => {
    const items = visibleTabBarItems(), map = visibleTabBarItemMap()
    expect(items.map((item) => item.key)).toEqual(SHELL_TABS.map((tab) => tab.key))
    SHELL_TABS.forEach((tab, index) => {
      expect(items[index]).toMatchObject({ key: tab.key, label: tab.label, icon: tab.icon, accessibilityLabel: tab.accessibilityLabel })
      expect(map[tab.key]).toMatchObject({ label: tab.label, route: tab.href, icon: tab.icon })
    })
  })
})

describe("B13 — sensitive reauthentication dialogs", () => {
  it("password, OTP, confirm, and cancel are in the same keyboard-avoiding scrollable dialog", () => {
    render(themed(<SensitiveConfirmDialog visible title="Buat kode cadangan baru?" consequences={["Kode lama akan hangus."]} confirmLabel="Buat Kode Baru" onConfirm={() => {}} onCancel={() => {}}>
      <PasswordField label="Kata sandi akun" value="" onChangeText={() => {}} />
      <OtpInput value="" onChange={() => {}} />
    </SensitiveConfirmDialog>))
    const stage = screen.getByTestId("keyboard-avoiding")
    expect(stage.contains(screen.getByRole("button", { name: "Buat Kode Baru" }))).toBe(true)
    expect(stage.contains(screen.getByRole("button", { name: "Batal" }))).toBe(true)
    expect(stage.querySelector("input")).toBeTruthy()
    expect(stage.contains(screen.getByRole("button", { name: /Kode 6 digit/ }))).toBe(true)
  })
})

describe("B16 — rating distribution lifecycle", () => {
  it("renders a five-bar skeleton before data, then the actual server summary and filter", async () => {
    let resolve!: (value: unknown) => void
    state.ratings.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const select = vi.fn()
    render(themed(<RatingDistributionBars username="budi" onSelectStars={select} />))
    expect(screen.getByRole("progressbar")).toBeTruthy()
    expect(screen.queryByText("0,0")).toBeNull()
    await act(async () => resolve({ distribution: { counts: [0, 0, 1, 1, 2], total: 4 }, averageRating: 4.25 }))
    expect(screen.queryByRole("progressbar")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "2 ulasan bintang 5" }))
    expect(select).toHaveBeenCalledWith(5)
  })
  it("failure is visible and retry loads the distribution without inventing numbers", async () => {
    state.ratings.mockRejectedValueOnce(new Error("offline"))
    render(themed(<RatingDistributionBars username="budi" />))
    expect(await screen.findByText("Distribusi ulasan belum tersedia")).toBeTruthy()
    expect(screen.getByRole("alert")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(await screen.findByRole("button", { name: "2 ulasan bintang 5" })).toBeTruthy()
    expect(state.ratings).toHaveBeenCalledTimes(2)
  })
  it("switching username does not leak the previous summary during a slow request", async () => {
    const { rerender } = render(themed(<RatingDistributionBars username="budi" />))
    await screen.findByRole("button", { name: "2 ulasan bintang 5" })
    state.ratings.mockReturnValueOnce(new Promise(() => {}))
    rerender(themed(<RatingDistributionBars username="sari" />))
    expect(screen.getByRole("progressbar")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "2 ulasan bintang 5" })).toBeNull()
  })
})

describe("C1 — permanent follow placement", () => {
  it("feed/list cards never render a follow action", async () => {
    render(themed(<ShowcaseFeedItem item={item} />))
    await act(async () => {})
    expect(screen.queryByRole("button", { name: /^(Ikuti|Berhenti mengikuti)$/ })).toBeNull()
    expect(state.follow).not.toHaveBeenCalled()
  })
  it("author row has no direct follow button; it exists only after opening the detail menu", async () => {
    render(themed(<ShowcaseAuthorRow item={item} isOwner={false} hasSession onReport={() => {}} />))
    await act(async () => {})
    expect(screen.queryByRole("button", { name: "Ikuti" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Pilihan etalase" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ikuti" }))
    expect(state.follow).toHaveBeenCalledWith(true)
  })
})

function MediaBridge({ kind, like }: { kind: "image" | "video"; like: () => void }) {
  const [opening, setOpening] = useState<OpeningMediaTap>()
  const media = kind === "video" ? video : image
  return <><ShowcaseMediaGallery media={[media]} title="Bridge" onDoubleTap={like} onOpen={(_index, tap) => setOpening(tap)} />
    {opening ? <ImageViewer visible images={[{ url: media.url, kind }]} openingTap={opening} onClose={() => {}} /> : null}</>
}
const touch = (x = 90, y = 120) => ({ pageX: x, pageY: y, identifier: 1 })
function openingFrame(kind: "image" | "video", like: () => void) {
  render(themed(<MediaBridge kind={kind} like={like} />))
  fireEvent.click(screen.getByRole("button", { name: kind === "image" ? "Lihat foto 1 dari 1" : "Lihat video: Bridge" }), { clientX: 90, clientY: 120 })
  return (kind === "image" ? screen.getByTestId("zoomable") : screen.getAllByTestId("video").at(-1)!).parentElement!
}
function secondTouch(frame: HTMLElement) {
  fireEvent.touchStart(frame, { touches: [touch()], changedTouches: [touch()] })
  fireEvent.touchEnd(frame, { touches: [], changedTouches: [touch()] })
}
describe("B14 — real Gallery -> ImageViewer opening gesture bridge", () => {
  it.each(["image", "video"] as const)("%s opens immediately and likes exactly once across the modal", (kind) => {
    const like = vi.fn(), frame = openingFrame(kind, like)
    expect(like).not.toHaveBeenCalled()
    if (kind === "video") expect(screen.getAllByTestId("video").at(-1)?.getAttribute("data-toggle")).toBe("false")
    secondTouch(frame)
    expect(like).toHaveBeenCalledTimes(1)
    fireEvent.touchEnd(frame, { changedTouches: [touch()], touches: [] })
    expect(like).toHaveBeenCalledTimes(1)
    if (kind === "video") expect(screen.getAllByTestId("video").at(-1)?.getAttribute("data-toggle")).toBe("true")
  })
  it("does not like after the opening interval expires", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000), like = vi.fn(), frame = openingFrame("image", like)
    clock.mockReturnValue(1301)
    secondTouch(frame)
    expect(like).not.toHaveBeenCalled()
  })
  it("movement cancels the opening gesture, even when it returns to its origin", () => {
    const like = vi.fn(), frame = openingFrame("image", like)
    fireEvent.touchStart(frame, { touches: [touch()], changedTouches: [touch()] })
    fireEvent.touchMove(frame, { touches: [touch(130)], changedTouches: [touch(130)] })
    fireEvent.touchEnd(frame, { changedTouches: [touch()], touches: [] })
    expect(like).not.toHaveBeenCalled()
  })
  it("multitouch cancels like and does not capture the zoom responder", () => {
    const like = vi.fn(), frame = openingFrame("image", like)
    fireEvent.touchStart(frame, { touches: [touch(), { ...touch(), identifier: 2 }], changedTouches: [touch()] })
    secondTouch(frame)
    expect(like).not.toHaveBeenCalled()
  })
})
