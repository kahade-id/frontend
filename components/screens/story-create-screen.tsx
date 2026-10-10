/**
 * Kahade — layar buat story (`/story/create`).
 *
 * Empat jalur: foto/video dari galeri, foto kamera, rekam video, atau teks
 * berlatar warna. Di pratinjau bisa: keterangan (caption) untuk foto/video,
 * tag produk etalase (bisa digeser), stiker harga, tombol "Tanya Stok", dan
 * privasi per-story (semua penyimpan / kecuali beberapa).
 *
 * Bagikan = OPTIMISTIS: layar langsung tertutup dan story tampil sebagai "sedang
 * diunggah" di tray dengan progress byte. Unggah + buat berjalan di latar
 * (`lib/story/publish.ts`). Bila gagal, entri tetap di tray sebagai GAGAL
 * dengan pesan spesifik dan tombol "Coba lagi" — draft tidak hilang.
 *
 * Pratinjau = WYSIWYG viewer: foto `contain` di atas hitam (bukan `cover`),
 * supaya posisi tag produk yang digeser di sini sama dengan yang dilihat
 * penonton (audit 2026-10-10 #31).
 */
import { router } from "expo-router"

import { ROUTES } from "@/lib/routes"

/**
 * 2026-10-08 (temuan #17): tutup pembuat story.
 *
 * `router.back()` saja bisa no-op bila rute ini adalah satu-satunya entri
 * stack (dibuka dari tautan langsung) — layar tak bisa ditutup dan
 * pengguna terjebak. Tray story hidup di tab Pesan, jadi itu fallback-nya.
 */
function closeStoryCreate(): void {
  if (router.canGoBack()) router.back()
  else router.replace(ROUTES.chat)
}
import {
  Camera,
  Check,
  Images,
  PaperPlaneRight,
  ShoppingBag,
  Storefront,
  TextAa,
  VideoCamera,
  X,
} from "phosphor-react-native"
import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"

import { Button } from "@/components/ui/button"
import { FeedVideo } from "@/components/ui/feed-video"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { StoryAudienceSheet } from "@/components/story/story-audience-sheet"
import { StoryDraggableTag } from "@/components/story/story-draggable-tag"
import { StoryProductPicker } from "@/components/story/story-product-picker"
import {
  STORY_PRODUCT_TAGS_MAX,
  STORY_TEXT_MAX,
  STORY_VIDEO_MAX_DURATION_MS,
  type StoryAudience,
  type StoryMediaKind,
} from "@/lib/api/story"
import { pickImage, type PickedImage } from "@/lib/image-picker"
import { formatMediaClock } from "@/lib/media-viewer"
import { storyMediaKindOf, validateStoryMediaAsset } from "@/lib/story-media-limits"
import { haptic } from "@/lib/haptics"
import { useT } from "@/lib/i18n"
import {
  STORY_TEXT_BACKGROUNDS,
  clamp01,
  emptyStoryDraft,
  formatPriceSticker,
  isMediaStoryKind,
  parsePriceInput,
  validateStoryDraft,
  type DraftProblem,
  type ProductTagDraft,
  type StoryDraft,
} from "@/lib/story/compose"
import { publishStory, retryPublishStory, type PublishStoryCallbacks } from "@/lib/story/publish"

type Stage = "choose" | "edit"

type Media = { asset: PickedImage; kind: StoryMediaKind } | null

type PickMode = "gallery" | "photo" | "video"

export default function StoryCreateScreen() {
  const t = useT()
  const toast = useToast()
  const { width: winW } = useWindowDimensions()

  const [stage, setStage] = useState<Stage>("choose")
  const [draft, setDraft] = useState<StoryDraft>(() => emptyStoryDraft("text"))
  const [media, setMedia] = useState<Media>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 })
  const [productSnapshot, setProductSnapshot] = useState<Record<string, string>>({})
  // Judul produk dicatat saat dipilih, supaya chip/tag tetap terbaca tanpa memuat ulang etalase.

  const previewWidth = Math.min(winW * 0.62, 260)
  const previewHeight = previewWidth * (16 / 9)

  const update = useCallback((patch: Partial<StoryDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const problemText = (p: DraftProblem): string => {
    switch (p) {
      case "media-required":
        return draft.kind === "video" ? t("Pilih video dulu.") : t("Pilih foto dulu.")
      case "text-required":
        return t("Tulis teks untuk story.")
      case "text-too-long":
        return t("Teks story terlalu panjang.")
      case "price-invalid":
        return t("Harga tidak valid.")
      case "too-many-tags":
        return t("Maksimal {n} produk per story.", { n: STORY_PRODUCT_TAGS_MAX })
    }
  }

  // ---- Pilih media ----

  const pickMedia = useCallback(
    async (mode: PickMode) => {
      const res = await pickImage(
        mode === "gallery"
          ? { source: "library", quality: 0.8, allowsEditing: false, allowVideos: true, videoMaxDurationSec: STORY_VIDEO_MAX_DURATION_MS / 1000 }
          : mode === "video"
            ? { source: "camera", videoOnly: true, videoMaxDurationSec: STORY_VIDEO_MAX_DURATION_MS / 1000 }
            : { source: "camera", quality: 0.8, allowsEditing: false },
      )
      if (res.status === "denied") {
        toast.show({
          title: mode === "gallery" ? t("Izin galeri ditolak") : t("Izin kamera ditolak"),
          description: t("Aktifkan izin di Pengaturan perangkat untuk memilih foto."),
          tone: "warning",
        })
        return
      }
      if (res.status !== "picked") return
      // Audit 2026-10-09 (C2) + video 2026-10-10: guard ukuran/durasi/format
      // SEBELUM user menyusun story — server pasti menolak (413/415/VIDEO_TOO_LONG);
      // dulu gagal misterius di tengah/sesudah upload.
      const kind = storyMediaKindOf(res.asset)
      const guardError = validateStoryMediaAsset(res.asset)
      if (kind === "unsupported" || guardError) {
        haptic("warning")
        toast.show({
          title: kind === "video" ? t("Video tidak bisa dipakai") : t("Foto tidak bisa dipakai"),
          description: guardError ? t(guardError) : t("Format tidak didukung. Gunakan foto JPEG/PNG atau video MP4/MOV."),
          tone: "danger",
        })
        return
      }
      setMedia({ asset: res.asset, kind })
      setDraft({ ...emptyStoryDraft(kind) })
      setStage("edit")
    },
    [toast, t],
  )

  const startText = useCallback(() => {
    setMedia(null)
    setDraft(emptyStoryDraft("text"))
    setStage("edit")
  }, [])

  // ---- Tag produk ----

  const onPickProducts = useCallback(
    (picked: Array<{ productId: string; title: string }>) => {
      setPickerOpen(false)
      setProductSnapshot((prev) => ({
        ...prev,
        ...Object.fromEntries(picked.map((p) => [p.productId, p.title])),
      }))
      const ids = picked.map((p) => p.productId)
      setDraft((prev) => {
        const kept = prev.productTags.filter((tag) => ids.includes(tag.productId))
        const added = picked
          .filter((p) => !prev.productTags.some((tag) => tag.productId === p.productId))
          .map((p, i): ProductTagDraft => ({
            productId: p.productId,
            title: p.title,
            x: 0.5,
            y: clamp01(0.3 + (kept.length + i) * 0.12),
          }))
        const tags = [...kept, ...added].slice(0, STORY_PRODUCT_TAGS_MAX)
        const askId =
          prev.askStockProductId && tags.some((tag) => tag.productId === prev.askStockProductId)
            ? prev.askStockProductId
            : null
        return { ...prev, productTags: tags, askStockProductId: askId }
      })
    },
    [],
  )

  const moveTag = useCallback((productId: string, x: number, y: number) => {
    setDraft((prev) => ({
      ...prev,
      productTags: prev.productTags.map((tag) => (tag.productId === productId ? { ...tag, x, y } : tag)),
    }))
  }, [])

  const removeTag = useCallback((productId: string) => {
    haptic("light")
    setDraft((prev) => ({
      ...prev,
      productTags: prev.productTags.filter((tag) => tag.productId !== productId),
      askStockProductId: prev.askStockProductId === productId ? null : prev.askStockProductId,
    }))
  }, [])

  // ---- Bagikan (optimistis, pekerjaan latar di lib/story/publish) ----

  const share = useCallback(() => {
    const problem = validateStoryDraft(draft, { mediaPicked: media !== null })
    if (problem) {
      haptic("warning")
      toast.show({ title: problemText(problem), tone: "danger" })
      return
    }
    haptic("success")
    let localId = ""
    const callbacks: PublishStoryCallbacks = {
      onFailure: (message) => {
        toast.show({
          title: t("Story belum terbagikan"),
          description: message,
          tone: "danger",
          action: {
            label: t("Coba lagi"),
            onPress: () => {
              retryPublishStory(localId, callbacks)
            },
          },
        })
      },
    }
    localId = publishStory({ draft, media: media?.asset ?? null }, callbacks)
    closeStoryCreate()
    // problemText membaca draft.kind — sudah tercakup oleh dependensi `draft`.
  }, [draft, media, toast, t])

  // ---- Render ----

  const bg = draft.backgroundColor
  const priceValue = useMemo(() => parsePriceInput(draft.priceText), [draft.priceText])
  const isMedia = isMediaStoryKind(draft.kind)
  const caption = draft.text.trim()

  if (stage === "choose") {
    return (
      <Screen edges={["top", "bottom"]} padded={false}>
        <Header title={t("Story baru")} onClose={closeStoryCreate} closeLabel={t("Tutup")} />
        <View className="flex-1 justify-center gap-3 px-6">
          <Text variant="h3" className="text-center">{t("Bagikan momen tokomu")}</Text>
          <Text variant="body" tone="secondary" className="mb-2 text-center">
            {t("Hilang otomatis setelah 24 jam. Hanya penyimpan profil Anda yang melihat.")}
          </Text>
          <ChooseCard
            icon={Images}
            label={t("Foto atau video dari galeri")}
            onPress={() => void pickMedia("gallery")}
            testID="story-choose-gallery"
          />
          <ChooseCard
            icon={Camera}
            label={t("Ambil foto")}
            onPress={() => void pickMedia("photo")}
            testID="story-choose-camera"
          />
          <ChooseCard
            icon={VideoCamera}
            label={t("Rekam video")}
            onPress={() => void pickMedia("video")}
            testID="story-choose-video"
          />
          <ChooseCard icon={TextAa} label={t("Tulis teks")} onPress={startText} testID="story-choose-text" />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={["top", "bottom"]} padded={false}>
      <Header
        title={t("Story baru")}
        onClose={closeStoryCreate}
        closeLabel={t("Tutup")}
        right={
          <Button variant="primary" size="sm" onPress={share} accessibilityLabel={t("Bagikan story")} rightIcon={PaperPlaneRight}>
            {t("Bagikan")}
          </Button>
        }
      />
      <ScrollView contentContainerClassName="items-center gap-4 px-4 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <View
          className="overflow-hidden rounded-md bg-black"
          style={{ width: previewWidth, height: previewHeight, backgroundColor: draft.kind === "text" ? bg : "#000000" }}
          onLayout={(e) => setPreviewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          accessibilityLabel={t("Pratinjau story")}
        >
          {draft.kind === "image" && media ? (
            <Image source={{ uri: media.asset.uri }} style={{ flex: 1 }} contentFit="contain" transition={0} />
          ) : draft.kind === "video" && media ? (
            <View className="flex-1 justify-center">
              <FeedVideo
                source={media.asset.uri}
                alt={t("Pratinjau video story")}
                shouldPlay
                userInitiatedPlay
                loop
                muted
                aspectRatio={9 / 16}
              />
              {typeof media.asset.durationMs === "number" ? (
                <View className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5" pointerEvents="none">
                  <Text variant="caption" weight={600} className="text-white">
                    {formatMediaClock(media.asset.durationMs / 1000)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-4">
              <Input
                value={draft.text}
                onChangeText={(v) => update({ text: v.slice(0, STORY_TEXT_MAX) })}
                placeholder={t("Tulis sesuatu…")}
                multiline
                accessibilityLabel={t("Teks story")}
                className="w-full text-center text-white"
              />
            </View>
          )}

          {/* Caption foto/video — posisi sama dengan viewer (di atas footer). */}
          {isMedia && caption ? (
            <View className="absolute bottom-3 left-2 right-2 items-center" pointerEvents="none">
              <View className="rounded-md bg-black/60 px-2.5 py-1.5">
                <Text variant="caption" weight={600} className="text-center text-white" numberOfLines={3}>
                  {caption}
                </Text>
              </View>
            </View>
          ) : null}

          {draft.productTags.map((tag) => (
            <StoryDraggableTag
              key={tag.productId}
              productId={tag.productId}
              title={tag.title || productSnapshot[tag.productId] || ""}
              x={tag.x}
              y={tag.y}
              width={previewSize.width}
              height={previewSize.height}
              onMove={moveTag}
              onRemove={removeTag}
            />
          ))}

          {priceValue !== null ? (
            <View className="absolute left-0 right-0 items-center" style={{ top: "42%" }} pointerEvents="none">
              <View className="rounded-md bg-white px-3 py-1.5">
                <Text variant="label" weight={700} className="text-black">
                  {formatPriceSticker(priceValue)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {draft.kind === "text" ? (
          <View className="flex-row gap-2">
            {STORY_TEXT_BACKGROUNDS.map((c) => (
              <Pressable
                key={c}
                onPress={() => update({ backgroundColor: c })}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.backgroundColor === c }}
                accessibilityLabel={t("Latar {color}", { color: c })}
                className={`h-8 w-8 rounded-full border-2 ${draft.backgroundColor === c ? "border-primary" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </View>
        ) : null}

        <View className="w-full gap-3">
          {isMedia ? (
            <Input
              value={draft.text}
              onChangeText={(v) => update({ text: v.slice(0, STORY_TEXT_MAX) })}
              placeholder={t("Tulis keterangan…")}
              maxLength={STORY_TEXT_MAX}
              accessibilityLabel={t("Keterangan story")}
            />
          ) : null}

          <PressableScale
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("Tag produk etalase")}
            className="flex-row items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <View className="flex-row items-center gap-2">
              <Icon icon={Storefront} size="sm" tone="default" />
              <Text variant="label" weight={600}>{t("Tag produk etalase")}</Text>
            </View>
            <Text variant="caption" tone="secondary">
              {t("{n}/{max}", { n: draft.productTags.length, max: STORY_PRODUCT_TAGS_MAX })}
            </Text>
          </PressableScale>

          <View className="gap-2 rounded-md border border-border px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Icon icon={ShoppingBag} size="sm" tone="default" />
              <Text variant="label" weight={600}>{t("Stiker harga")}</Text>
            </View>
            <Input
              value={draft.priceText}
              onChangeText={(v) => update({ priceText: v.replace(/[^\d.]/g, "") })}
              placeholder={t("Contoh: 350000")}
              keyboardType="number-pad"
              accessibilityLabel={t("Harga untuk stiker")}
            />
          </View>

          <View className="gap-2 rounded-md border border-border px-4 py-3">
            <PressableScale
              onPress={() => update({ askStock: !draft.askStock })}
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.askStock }}
              accessibilityLabel={t("Tombol Tanya Stok")}
              className="flex-row items-center justify-between"
            >
              <View className="flex-1 pr-3">
                <Text variant="label" weight={600}>{t("Tombol Tanya Stok")}</Text>
                <Text variant="caption" tone="secondary">{t("Penonton bisa langsung menanyakan stok ke Anda.")}</Text>
              </View>
              <Icon icon={draft.askStock ? Check : X} size="sm" tone={draft.askStock ? "active" : "default"} />
            </PressableScale>
            {draft.askStock && draft.productTags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 pt-1">
                <Chip
                  label={t("Umum")}
                  selected={draft.askStockProductId === null}
                  onPress={() => update({ askStockProductId: null })}
                />
                {draft.productTags.map((tag) => (
                  <Chip
                    key={tag.productId}
                    label={tag.title || productSnapshot[tag.productId] || t("Produk")}
                    selected={draft.askStockProductId === tag.productId}
                    onPress={() => update({ askStockProductId: tag.productId })}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <PressableScale
            onPress={() => setAudienceOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("Siapa yang bisa melihat")}
            className="flex-row items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <Text variant="label" weight={600}>{t("Siapa yang bisa melihat")}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {draft.audience.mode === "all_savers"
                ? t("Semua penyimpan profil")
                : t("Kecuali {n} orang", { n: draft.audience.excludedUserIds.length })}
            </Text>
          </PressableScale>
        </View>
      </ScrollView>

      <StoryProductPicker
        visible={pickerOpen}
        selectedIds={draft.productTags.map((tag) => tag.productId)}
        onDone={onPickProducts}
        onRequestClose={() => setPickerOpen(false)}
      />

      <StoryAudienceSheet
        visible={audienceOpen}
        value={draft.audience}
        onChange={(audience: StoryAudience) => update({ audience })}
        onRequestClose={() => setAudienceOpen(false)}
      />
    </Screen>
  )
}

function Header({
  title,
  onClose,
  closeLabel,
  right,
}: {
  title: string
  onClose: () => void
  closeLabel: string
  right?: React.ReactNode
}) {
  return (
    <View className="h-14 flex-row items-center justify-between px-3">
      <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} className="h-10 w-10 items-center justify-center">
        <Icon icon={X} size="md" tone="default" />
      </PressableScale>
      <Text variant="label" weight={600}>{title}</Text>
      <View className="min-w-[40px] items-end">{right ?? null}</View>
    </View>
  )
}

function ChooseCard({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconComponent
  label: string
  onPress: () => void
  testID: string
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      className="flex-row items-center gap-4 rounded-md border border-border px-5 py-4"
    >
      <Icon icon={icon} size="md" tone="default" />
      <Text variant="label" weight={600}>{label}</Text>
    </PressableScale>
  )
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={`rounded-full border px-3 py-1.5 ${selected ? "border-primary bg-primary" : "border-border"}`}
    >
      <Text variant="caption" weight={600} tone={selected ? "inverse" : "secondary"} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  )
}
