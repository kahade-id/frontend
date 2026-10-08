/**
 * Kahade — layar buat story (`/story/create`).
 *
 * Tiga jalur: foto dari galeri, foto dari kamera, atau teks berlatar warna.
 * Di pratinjau bisa: tag produk etalase (bisa digeser), stiker harga, tombol
 * "Tanya Stok", dan privasi per-story (semua penyimpan / kecuali beberapa).
 *
 * Bagikan = OPTIMISTIS: layar langsung tertutup dan story tampil sebagai "sedang
 * diunggah" di tray. Unggah + buat dijalankan di latar belakang. Bila gagal,
 * entri optimistis dibatalkan (rollback) dan pengguna diberi tahu lewat toast.
 * Draft tidak disimpan ulang — itu disengaja agar tidak ada story setengah jadi.
 */
import { router } from "expo-router"
import { Camera, Check, Images, PaperPlaneRight, ShoppingBag, Storefront, TextAa, X } from "phosphor-react-native"
import { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"

import { Button } from "@/components/ui/button"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { StoryAudienceSheet } from "@/components/story/story-audience-sheet"
import { StoryDraggableTag } from "@/components/story/story-draggable-tag"
import { StoryProductPicker } from "@/components/story/story-product-picker"
import { userMessage } from "@/lib/api/errors"
import {
  STORY_PRODUCT_TAGS_MAX,
  STORY_TEXT_MAX,
  createStory,
  uploadStoryMedia,
  type StoryAudience,
} from "@/lib/api/story"
import { pickImage, pickedImageToFormData, type PickedImage } from "@/lib/image-picker"
import { haptic } from "@/lib/haptics"
import { useT } from "@/lib/i18n"
import {
  STORY_TEXT_BACKGROUNDS,
  buildCreateInput,
  clamp01,
  emptyStoryDraft,
  formatPriceSticker,
  parsePriceInput,
  validateStoryDraft,
  type DraftProblem,
  type ProductTagDraft,
  type StoryDraft,
} from "@/lib/story/compose"
import {
  addPendingStoryLocal,
  bumpStoryRevision,
  removePendingStoryLocal,
  type PendingStory,
} from "@/lib/story/local-state"

type Stage = "choose" | "edit"

type Media = { asset: PickedImage } | null

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
        return t("Pilih foto dulu.")
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

  const takePhoto = useCallback(
    async (source: "library" | "camera") => {
      const res = await pickImage({ source, quality: 0.8, allowsEditing: false })
      if (res.status === "denied") {
        toast.show({
          title: source === "camera" ? t("Izin kamera ditolak") : t("Izin galeri ditolak"),
          description: t("Aktifkan izin di Pengaturan perangkat untuk memilih foto."),
          tone: "warning",
        })
        return
      }
      if (res.status !== "picked") return
      setMedia({ asset: res.asset })
      setDraft({ ...emptyStoryDraft("image") })
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

  // ---- Bagikan (optimistis) ----

  const share = useCallback(() => {
    const problem = validateStoryDraft(draft)
    if (problem) {
      haptic("warning")
      toast.show({ title: problemText(problem), tone: "danger" })
      return
    }
    haptic("success")
    const localId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const snapshot = draft
    const mediaAsset = media?.asset ?? null
    const optimistic: PendingStory = {
      localId,
      kind: snapshot.kind,
      mediaUri: mediaAsset?.uri ?? null,
      text: snapshot.kind === "text" ? snapshot.text.trim() : snapshot.text.trim() || null,
      backgroundColor: snapshot.kind === "text" ? snapshot.backgroundColor : null,
      createdAt: Date.now(),
      status: "uploading",
    }
    const undo = addPendingStoryLocal(optimistic)
    router.back()

    void (async () => {
      try {
        let mediaId: string | undefined
        if (snapshot.kind === "image") {
          if (!mediaAsset) throw new Error("media")
          const form = await pickedImageToFormData(mediaAsset)
          mediaId = (await uploadStoryMedia(form)).mediaId
        }
        await createStory(buildCreateInput({ ...snapshot, mediaId: mediaId ?? null }))
        removePendingStoryLocal(localId)
        bumpStoryRevision()
      } catch (err) {
        // Rollback: entri optimistis dibatalkan; story tidak pernah tercatat di server.
        undo()
        toast.show({
          title: t("Story belum terbagikan"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, media, toast, t])

  // ---- Render ----

  const bg = draft.backgroundColor
  const priceValue = useMemo(() => parsePriceInput(draft.priceText), [draft.priceText])

  if (stage === "choose") {
    return (
      <Screen edges={["top", "bottom"]} padded={false}>
        <Header title={t("Story baru")} onClose={() => router.back()} closeLabel={t("Tutup")} />
        <View className="flex-1 justify-center gap-4 px-6">
          <Text variant="h3" className="text-center">{t("Bagikan momen tokomu")}</Text>
          <Text variant="body" tone="secondary" className="text-center">
            {t("Story hilang otomatis setelah 24 jam dan hanya terlihat oleh orang yang menyimpan profil Anda.")}
          </Text>
          <ChooseCard
            icon={Images}
            label={t("Foto dari galeri")}
            onPress={() => void takePhoto("library")}
            testID="story-choose-gallery"
          />
          <ChooseCard
            icon={Camera}
            label={t("Ambil foto")}
            onPress={() => void takePhoto("camera")}
            testID="story-choose-camera"
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
        onClose={() => router.back()}
        closeLabel={t("Tutup")}
        right={
          <Button variant="primary" size="sm" onPress={share} accessibilityLabel={t("Bagikan story")} rightIcon={PaperPlaneRight}>
            {t("Bagikan")}
          </Button>
        }
      />
      <ScrollView contentContainerClassName="items-center gap-4 px-4 pb-8 pt-2" keyboardShouldPersistTaps="handled">
        <View
          className="overflow-hidden rounded-md bg-surface"
          style={{ width: previewWidth, height: previewHeight, backgroundColor: draft.kind === "text" ? bg : undefined }}
          onLayout={(e) => setPreviewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          accessibilityLabel={t("Pratinjau story")}
        >
          {draft.kind === "image" && media ? (
            <Image source={{ uri: media.asset.uri }} style={{ flex: 1 }} contentFit="cover" transition={0} />
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
