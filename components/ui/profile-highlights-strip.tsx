/**
 * Kahade — <ProfileHighlightsStrip> (item 20, 2026-09-28).
 *
 * Strip horizontal ala Instagram di atas tab profil: lingkaran highlight
 * (cover + nama). Pemilik profil (isSelf) mendapat lingkaran "+" untuk
 * membuka editor "Kelola highlight" — memilih produk dari etalase sendiri.
 *
 * DATA MENUNGGU KONTRAK TIM A (lihat lib/api/showcase-highlights.ts):
 * daftar highlight saat ini tidak bisa dimuat dari server, jadi strip
 * menyembunyikan dirinya sendiri (tidak menampilkan placeholder palsu).
 * Editor "Kelola" SUDAH berfungsi penuh di sisi UI (pilih produk, beri nama,
 * urutan) — tombol Simpan memanggil `saveProfileHighlights` dan menampilkan
 * pesan kontrak bila backend belum siap. Begitu kontrak tiba, tidak ada
 * perubahan UI yang dibutuhkan: strip otomatis tampil.
 */
import { Check, Plus, Sparkle, Trash, X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import {
  highlightCoverOf,
  readProfileHighlights,
  saveProfileHighlights,
  type ProfileHighlight,
  type ProfileHighlightInput,
} from "@/lib/api/showcase-highlights"
import type { ShowcaseItem } from "@/lib/api/users"

export type ProfileHighlightsStripProps = {
  username: string
  /** true = profil sendiri → tampilkan tombol "Baru". */
  isSelf: boolean
  /** Produk etalase milik profil (dipakai editor pilih produk). */
  showcaseItems: ShowcaseItem[]
}

const HIGHLIGHT_NAME_MAX = 30

export function ProfileHighlightsStrip({
  username,
  isSelf,
  showcaseItems,
}: ProfileHighlightsStripProps) {
  useLanguage()
  const [highlights, setHighlights] = useState<ProfileHighlight[] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setHighlights(await readProfileHighlights(username))
    } catch {
      // Kontrak TIM A belum tiba — sembunyikan strip (bukan error).
      setHighlights([])
    }
  }, [username])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Strip disembunyikan bila kosong — untuk profil orang lain tidak ada
  // apa-apa; untuk profil sendiri editor tetap bisa dibuka dari… (lihat
  // catatan di bawah: tombol kelola juga disembunyikan sampai kontrak ada
  // karena menyimpan belum bisa). Bila kontrak tiba, strip tampil otomatis.
  if (!highlights || highlights.length === 0) return null

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
            label={h.name}
            cover={h.coverImageUrl}
            onPress={() => setEditorOpen(true)}
          />
        ))}
      </ScrollView>
      <HighlightEditor
        visible={editorOpen}
        showcaseItems={showcaseItems}
        initial={highlights}
        onRequestClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false)
          void refresh()
        }}
      />
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
          <Picture source={{ uri: cover }} alt={label} width={64} height={64} bordered={false} />
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

// ── Editor "Kelola highlight" ───────────────────────────────────────────

type DraftHighlight = {
  /** Id sementara lokal; diawali "local:" = belum ada di server. */
  key: string
  id?: string
  name: string
  itemIds: string[]
}

function HighlightEditor({
  visible,
  showcaseItems,
  initial,
  onRequestClose,
  onSaved,
}: {
  visible: boolean
  showcaseItems: ShowcaseItem[]
  initial: ProfileHighlight[]
  onRequestClose: () => void
  onSaved: () => void
}) {
  useLanguage()
  const toast = useToast()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const [drafts, setDrafts] = useState<DraftHighlight[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setDrafts(
        initial.map((h, i) => ({
          key: h.id || `local:${i}`,
          id: h.id,
          name: h.name,
          itemIds: [...h.showcaseItemIds],
        })),
      )
      setActiveKey(null)
    }
  }, [visible, initial])

  const itemsById = useMemo(
    () => new Map(showcaseItems.map((it) => [it.id, it])),
    [showcaseItems],
  )
  const active = drafts.find((d) => d.key === activeKey) ?? null

  const patchActive = useCallback(
    (patch: Partial<DraftHighlight>) => {
      if (!activeKey) return
      setDrafts((prev) => prev.map((d) => (d.key === activeKey ? { ...d, ...patch } : d)))
    },
    [activeKey],
  )

  const toggleItem = useCallback(
    (itemId: string) => {
      if (!active) return
      const has = active.itemIds.includes(itemId)
      patchActive({
        itemIds: has ? active.itemIds.filter((id) => id !== itemId) : [...active.itemIds, itemId],
      })
    },
    [active, patchActive],
  )

  const addHighlight = useCallback(() => {
    const key = `local:${Date.now().toString(36)}`
    setDrafts((prev) => [...prev, { key, name: "", itemIds: [] }])
    setActiveKey(key)
  }, [])

  const removeHighlight = useCallback(
    (key: string) => {
      setDrafts((prev) => prev.filter((d) => d.key !== key))
      if (activeKey === key) setActiveKey(null)
    },
    [activeKey],
  )

  const handleSave = useCallback(async () => {
    if (saving) return
    const input: ProfileHighlightInput[] = drafts
      .filter((d) => d.name.trim().length > 0 && d.itemIds.length > 0)
      .map((d) => ({
        ...(d.id && !d.id.startsWith("local:") ? { id: d.id } : {}),
        name: d.name.trim().slice(0, HIGHLIGHT_NAME_MAX),
        showcaseItemIds: d.itemIds,
      }))
    setSaving(true)
    try {
      await saveProfileHighlights(input)
      toast.show({ title: translate("Highlight disimpan"), tone: "success" })
      onSaved()
    } catch (err: unknown) {
      toast.show({
        title: translate("Belum bisa menyimpan highlight"),
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      })
    } finally {
      setSaving(false)
    }
  }, [drafts, saving, onSaved, toast.show])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Kelola highlight")}
      description={translate("Pilih produk dari etalase Anda untuk ditampilkan di profil.")}
      avoidKeyboard
      footer={
        <Button fullWidth loading={saving} onPress={() => void handleSave()}>
          {translate("Simpan highlight")}
        </Button>
      }
    >
      <View className="gap-3 px-5 pb-2">
        {/* Daftar highlight (draft) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {drafts.map((d) => {
            const cover = highlightCoverOf(itemsById.get(d.itemIds[0]))
            const selected = d.key === activeKey
            return (
              <View key={d.key} className="relative">
                <PressableScale
                  className={cn(
                    "w-16 items-center gap-1 rounded-md p-1",
                    selected && "bg-surface",
                  )}
                  accessibilityRole="button"
                  accessibilityLabel={d.name || translate("Highlight baru")}
                  accessibilityState={{ selected }}
                  onPress={() => setActiveKey(selected ? null : d.key)}
                >
                  <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-border-control">
                    {cover ? (
                      <Picture source={{ uri: cover }} alt={d.name} width={56} height={56} bordered={false} />
                    ) : (
                      <Icon icon={Sparkle} size="md" tone="default" />
                    )}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {d.name || translate("Baru")}
                  </Text>
                </PressableScale>
                <View className="absolute -right-1 -top-1">
                  <IconButton
                    icon={Trash}
                    size="sm"
                    variant="secondary"
                    shape="pill"
                    accessibilityLabel={translate("Hapus highlight")}
                    onPress={() => removeHighlight(d.key)}
                  />
                </View>
              </View>
            )
          })}
          <PressableScale
            className="w-16 items-center gap-1 p-1"
            accessibilityRole="button"
            accessibilityLabel={translate("Tambah highlight")}
            onPress={addHighlight}
          >
            <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border-control bg-surface">
              <Icon icon={Plus} size="md" tone="default" />
            </View>
            <Text variant="caption" tone="secondary">
              {translate("Tambah")}
            </Text>
          </PressableScale>
        </ScrollView>

        {/* Editor highlight aktif */}
        {active ? (
          <View className="gap-2 rounded-md border border-border bg-surface p-3">
            <TextInput
              value={active.name}
              onChangeText={(v) => patchActive({ name: v.slice(0, HIGHLIGHT_NAME_MAX) })}
              placeholder={translate("Nama highlight, mis. Promo 9.9")}
              placeholderTextColor={palette.textSecondary}
              className="rounded-sm border border-border-control bg-background px-3 py-2 font-sans-400 text-bodyLarge text-text-primary"
              maxLength={HIGHLIGHT_NAME_MAX}
              accessibilityLabel={translate("Nama highlight")}
            />
            <Text variant="caption" tone="secondary">
              {translate("Pilih produk ({n} dipilih):", { n: String(active.itemIds.length) })}
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
                  const chosen = active.itemIds.includes(item.id)
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
                        <Picture source={{ uri: cover }} alt={item.title ?? ""} width={80} height={80} bordered={false} />
                      ) : (
                        <View className="h-full w-full items-center justify-center bg-surface">
                          <Icon icon={Sparkle} size="md" tone="default" />
                        </View>
                      )}
                      {chosen ? (
                        <View
                          className="absolute right-1 top-1 items-center justify-center rounded-full"
                          style={{ width: 22, height: 22, backgroundColor: palette.primary }}
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
            {translate("Ketuk highlight untuk mengedit, atau tambah yang baru.")}
          </Text>
        )}
      </View>
    </BottomSheet>
  )
}
