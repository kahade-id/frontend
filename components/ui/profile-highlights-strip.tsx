/**
 * Kahade — <ProfileHighlightsStrip> (item 20).
 *
 * Strip horizontal ala Instagram di atas tab profil: lingkaran highlight
 * (cover + judul). Pemilik profil (isSelf) mendapat lingkaran "+" untuk
 * membuka editor — membuat, mengubah, atau menghapus highlight.
 *
 * KONTRAK AKTUAL BACKEND (terverifikasi 2026-10-03 di
 * backend-wt-auditfix/src/modules/showcase/highlights/ — lihat
 * lib/api/showcase-highlights.ts):
 * strip membaca GET /v1/users/:username/highlights (publik);
 * editor memakai CRUD /v1/highlights (milik sendiri).
 * - serializeHighlight: { id, title, coverMediaId, coverMediaUrl, products:
 *   [{ id, title, coverImageUrl }], productCount, ... } — BUKAN `productIds`
 *   maupun `coverUrl` (BFE-111: parse di lib menurunkannya).
 * - create/update opsional kirim `coverMediaId` (ShowcaseImage.id milik
 *   sendiri); dikosongkan = fallback otomatis ke media pertama (BFE-112).
 * Gagal muat = strip disembunyikan (fail closed, bukan placeholder palsu).
 */
import { Check, Plus, Sparkle, Warning, X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ImageViewer } from "@/components/ui/image-viewer"
import { Dialog } from "@/components/ui/modal"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import { isApiError, userMessage } from "@/lib/api"
import {
  HIGHLIGHTS_MAX,
  HIGHLIGHT_TITLE_MAX,
  createHighlight,
  deleteHighlight,
  highlightCoverOf,
  listMyHighlights,
  readProfileHighlights,
  updateHighlight,
  type ProfileHighlight,
  type ProfileHighlightPreview,
} from "@/lib/api/showcase-highlights"
import type { ShowcaseItem } from "@/lib/api/users"

export type ProfileHighlightsStripProps = {
  username: string
  /** true = profil sendiri → tampilkan tombol "Baru". */
  isSelf: boolean
  /** Produk etalase milik profil (dipakai editor pilih produk). */
  showcaseItems: ShowcaseItem[]
}

export function ProfileHighlightsStrip({
  username,
  isSelf,
  showcaseItems,
}: ProfileHighlightsStripProps) {
  useLanguage()
  const [highlights, setHighlights] = useState<ProfileHighlightPreview[] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  /**
   * Item 74b (keputusan batch-19 #3, mega-batch 2026-09-28): highlight di
   * profil ORANG LAIN yang diklik membuka VIEWER (konten publik — pratinjau
   * gambar highlight), BUKAN editor. Editor hanya milik sendiri.
   */
  const [viewerHighlight, setViewerHighlight] = useState<ProfileHighlightPreview | null>(null)

  const refresh = useCallback(async () => {
    try {
      setHighlights(await readProfileHighlights(username))
    } catch {
      // Fail closed: sembunyikan strip, bukan error/placeholder palsu.
      setHighlights([])
    }
  }, [username])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!highlights) return null
  // Profil orang lain tanpa highlight = tidak ada apa-apa. Profil sendiri
  // SELALU dapat tombol "Baru" (bahkan saat kosong) — inilah pintu masuk
  // create flow.
  if (highlights.length === 0 && !isSelf) return null

  return (
    <View className="pt-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-5"
        accessibilityRole="list"
        accessibilityLabel={translate("Highlight etalase")}
      >
        {isSelf ? (
          <HighlightCircle
            label={translate("Baru")}
            onPress={() => setEditorOpen(true)}
            action
          />
        ) : null}
        {highlights.map((h) => (
          <HighlightCircle
            key={h.id}
            label={h.title}
            cover={h.coverUrl ?? h.previewImageUrls[0] ?? null}
            onPress={() => (isSelf ? setEditorOpen(true) : setViewerHighlight(h))}
          />
        ))}
      </ScrollView>
      {isSelf ? (
        <HighlightEditor
          visible={editorOpen}
          showcaseItems={showcaseItems}
          onRequestClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false)
            void refresh()
          }}
        />
      ) : null}
      {/* Item 74b: viewer highlight profil orang lain — pratinjau publik. */}
      {viewerHighlight ? (
        <ImageViewer
          visible={viewerHighlight != null}
          images={(viewerHighlight.coverUrl ? [viewerHighlight.coverUrl] : viewerHighlight.previewImageUrls).map(
            (url) => ({ url, alt: viewerHighlight.title }),
          )}
          title={viewerHighlight.title}
          onClose={() => setViewerHighlight(null)}
        />
      ) : null}
    </View>
  )
}

function HighlightCircle({
  label,
  cover,
  onPress,
  action = false,
}: {
  label: string
  cover?: string | null
  onPress: () => void
  action?: boolean
}) {
  return (
    <PressableScale
      className="w-16 items-center gap-1"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <View
        className={cn(
          "h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2",
          action ? "border-dashed border-border-control bg-surface" : "border-border-focus",
        )}
      >
        {action ? (
          <Icon icon={Plus} size="md" tone="default" />
        ) : cover ? (
          <Picture source={{ uri: cover }} alt={label} width={64} height={64} bordered={false} priority="low" />
        ) : (
          <Icon icon={Sparkle} size="md" tone="default" />
        )}
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  )
}

// ── Editor highlight (create / patch / delete per item) ───────────────────

const NEW_KEY = "new"

function HighlightEditor({
  visible,
  showcaseItems,
  onRequestClose,
  onSaved,
}: {
  visible: boolean
  showcaseItems: ShowcaseItem[]
  onRequestClose: () => void
  onSaved: () => void
}) {
  useLanguage()
  const toast = useToast()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  /** Daftar milik sendiri dari server; null = memuat. */
  const [items, setItems] = useState<ProfileHighlight[] | null>(null)
  /** Id highlight yang diedit, atau NEW_KEY untuk buat baru. */
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [productIds, setProductIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Fail closed: kegagalan memuat daftar milik sendiri TIDAK dianggap
  // daftar kosong — tampilkan error + coba lagi, jangan buka editor
  // dengan asumsi kosong (bisa menutupi highlight yang sebenarnya ada).
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSeq, setLoadSeq] = useState(0)

  useEffect(() => {
    if (!visible) return
    setItems(null)
    setLoadError(null)
    setActiveKey(null)
    setName("")
    setProductIds([])
    setConfirmDelete(false)
    let alive = true
    listMyHighlights()
      .then((list) => {
        if (alive) setItems(list)
      })
      .catch((err: unknown) => {
        if (alive) {
          setLoadError(userMessage(err))
        }
      })
    return () => {
      alive = false
    }
  }, [visible, loadSeq])

  const itemsById = useMemo(
    () => new Map(showcaseItems.map((it) => [it.id, it])),
    [showcaseItems],
  )

  const startNew = useCallback(() => {
    setActiveKey(NEW_KEY)
    setName("")
    setProductIds([])
    setConfirmDelete(false)
  }, [])

  const startEdit = useCallback((h: ProfileHighlight) => {
    setActiveKey(h.id)
    setName(h.title)
    setProductIds([...h.productIds])
    setConfirmDelete(false)
  }, [])

  const toggleItem = useCallback((itemId: string) => {
    setProductIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (saving || !activeKey) return
    setSaving(true)
    try {
      if (activeKey === NEW_KEY) {
        await createHighlight({ title: name, productIds })
      } else {
        await updateHighlight(activeKey, { title: name, productIds })
      }
      toast.show({ title: translate("Highlight disimpan"), tone: "success" })
      onSaved()
    } catch (err: unknown) {
      const backendCode = isApiError(err) ? err.backendCode : undefined
      const limitReached = backendCode === "HIGHLIGHT_LIMIT_REACHED"
      toast.show({
        title: limitReached
          ? translate("Batas highlight tercapai")
          : translate("Gagal menyimpan highlight"),
        description: limitReached
          ? translate("Maksimal {x} highlight per akun. Hapus salah satu dulu.", {
              x: String(HIGHLIGHTS_MAX),
            })
          : // T4-005 (audit UI/UX intuitif 2026-09-29): jangan bocorkan
            // err.message mentah (bisa Inggris) — userMessage fail-closed
            // ke Bahasa Indonesia.
            userMessage(err),
        tone: "danger",
      })
    } finally {
      setSaving(false)
    }
  }, [saving, activeKey, name, productIds, toast, onSaved])

  const handleDelete = useCallback(async () => {
    if (deleting || !activeKey || activeKey === NEW_KEY) return
    setDeleting(true)
    try {
      await deleteHighlight(activeKey)
      toast.show({ title: translate("Highlight dihapus"), tone: "success" })
      onSaved()
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal menghapus highlight"),
        // T4-005 (audit UI/UX intuitif 2026-09-29): userMessage, bukan
        // err.message mentah.
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }, [deleting, activeKey, toast, onSaved])

  const activeIsNew = activeKey === NEW_KEY
  const activeExisting = activeKey && !activeIsNew ? items?.find((h) => h.id === activeKey) ?? null : null

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Kelola highlight")}
      description={translate("Pilih produk dari etalase Anda untuk ditampilkan di profil.")}
      avoidKeyboard
      footer={
        activeKey ? (
          <View className="gap-2">
            <Button fullWidth loading={saving} onPress={() => void handleSave()}>
              {translate("Simpan highlight")}
            </Button>
            {!activeIsNew ? (
              <Button
                variant="ghost"
                fullWidth
                loading={deleting}
                onPress={() => setConfirmDelete(true)}
              >
                {translate("Hapus highlight")}
              </Button>
            ) : null}
          </View>
        ) : undefined
      }
    >
      <View className="gap-3 px-5 pb-2">
        {/* Daftar highlight milik sendiri */}
        {loadError ? (
          <EmptyState
            icon={Warning}
            title={translate("Gagal memuat highlight")}
            description={loadError}
            action={
              <Button onPress={() => setLoadSeq((n) => n + 1)}>
                {translate("Coba lagi")}
              </Button>
            }
          />
        ) : items === null ? (
          <View className="flex-row gap-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="items-center gap-1">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-3 w-10 rounded" />
              </View>
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {items.map((h) => {
              const cover = h.coverUrl ?? highlightCoverOf(itemsById.get(h.productIds[0]))
              const selected = h.id === activeKey
              return (
                <PressableScale
                  key={h.id}
                  className={cn(
                    "w-16 items-center gap-1 rounded-md p-1",
                    selected && "bg-surface",
                  )}
                  accessibilityRole="button"
                  accessibilityLabel={h.title}
                  accessibilityState={{ selected }}
                  onPress={() => (selected ? setActiveKey(null) : startEdit(h))}
                >
                  <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-border-control">
                    {cover ? (
                      <Picture source={{ uri: cover }} alt={h.title} width={56} height={56} bordered={false} priority="low" />
                    ) : (
                      <Icon icon={Sparkle} size="md" tone="default" />
                    )}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {h.title}
                  </Text>
                </PressableScale>
              )
            })}
            <PressableScale
              className="w-16 items-center gap-1 p-1"
              accessibilityRole="button"
              accessibilityLabel={translate("Tambah highlight")}
              onPress={startNew}
            >
              <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border-control bg-surface">
                <Icon icon={Plus} size="md" tone="default" />
              </View>
              <Text variant="caption" tone="secondary">
                {translate("Tambah")}
              </Text>
            </PressableScale>
          </ScrollView>
        )}

        {/* Editor highlight aktif */}
        {activeKey ? (
          <View className="gap-2 rounded-md border border-border bg-surface p-3">
            <TextInput
              value={name}
              onChangeText={(v) => setName(v.slice(0, HIGHLIGHT_TITLE_MAX))}
              placeholder={translate("Nama highlight, mis. Promo 9.9")}
              placeholderTextColor={palette.textSecondary}
              className="rounded-sm border border-border-control bg-background px-3 py-2 font-sans-400 text-bodyLarge text-text-primary"
              maxLength={HIGHLIGHT_TITLE_MAX}
              accessibilityLabel={translate("Nama highlight")}
            />
            <Text variant="caption" tone="secondary">
              {translate("Pilih produk ({n} dipilih):", { n: String(productIds.length) })}
            </Text>
            {showcaseItems.length === 0 ? (
              <EmptyState
                icon={Sparkle}
                title={translate("Belum ada produk di etalase")}
                description={translate("Tambahkan produk ke etalase dulu untuk membuat highlight.")}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {showcaseItems.map((item) => {
                  const cover = highlightCoverOf(item)
                  const chosen = productIds.includes(item.id)
                  return (
                    <PressableScale
                      key={item.id}
                      className={cn(
                        "relative h-20 w-20 overflow-hidden rounded-sm border-2",
                        chosen ? "border-primary" : "border-transparent",
                      )}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: chosen }}
                      accessibilityLabel={item.title ?? translate("Produk")}
                      onPress={() => toggleItem(item.id)}
                    >
                      {cover ? (
                        <Picture source={{ uri: cover }} alt={item.title ?? ""} width={80} height={80} bordered={false} priority="low" />
                      ) : (
                        <View className="h-full w-full items-center justify-center bg-surface">
                          <Icon icon={Sparkle} size="md" tone="default" />
                        </View>
                      )}
                      {chosen ? (
                        <View
                          // h-5 w-5 (20px = icon.size.sm; dulu 22, di luar skala)
                          className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full"
                          style={{ backgroundColor: palette.primary }}
                        >
                          <Icon icon={Check} size="xs" tone="inverse" weight="bold" />
                        </View>
                      ) : null}
                    </PressableScale>
                  )
                })}
              </ScrollView>
            )}
            <View className="flex-row justify-end">
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Tutup editor highlight")}
                onPress={() => setActiveKey(null)}
              />
            </View>
          </View>
        ) : (
          <Text variant="caption" tone="secondary">
            {translate("Ketuk highlight untuk mengedit, tambah baru, atau hapus.")}
          </Text>
        )}
      </View>

      {/* Konfirmasi hapus */}
      <Dialog
        visible={confirmDelete}
        title={translate("Hapus highlight?")}
        description={translate("Highlight \"{x}\" akan dihapus dari profil Anda.", {
          x: activeExisting?.title ?? "",
        })}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
        onRequestClose={() => setConfirmDelete(false)}
      />
    </BottomSheet>
  )
}
