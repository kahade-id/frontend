/**
 * Screen — Showcase (GET/POST/DELETE /v1/users/me/showcase + upload).
 * Grid ShowcaseGalleryGrid + tambah lewat image picker → upload multipart.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Images, Plus } from "phosphor-react-native"
import * as ImagePicker from "expo-image-picker"

import { api } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseGalleryGrid, type ShowcaseItem as UiShowcaseItem } from "@/components/ui/showcase-gallery-grid"
import { useToast } from "@/components/ui/toast"

export default function ShowcaseScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UiShowcaseItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getMyShowcase()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat showcase.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    })
    if (res.canceled || !res.assets[0]) return
    setUploading(true)
    try {
      const asset = res.assets[0]
      const formData = new FormData()
      const name = asset.fileName ?? "showcase.jpg"
      const type = asset.mimeType ?? "image/jpeg"
      formData.append("file", { uri: asset.uri, name, type } as unknown as Blob)
      await api.users.uploadShowcase(formData)
      toast.show({ title: "Foto showcase ditambahkan", tone: "success", duration: 3000 })
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal mengunggah foto", tone: "danger" })
    } finally {
      setUploading(false)
    }
  }, [toast.show, fetchAll])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(deleteTarget.id)
      toast.show({ title: "Foto dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal menghapus foto", tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast.show, fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Showcase" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Images} title="Memuat showcase…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Portofolio Anda" />
            <ShowcaseGalleryGrid
              items={items.map((it) => ({
                id: it.id,
                source: it.imageUrl ?? it.fileKey ?? "",
                alt: it.caption ?? "Showcase",
              }))}
              onPressItem={(item) => setDeleteTarget(item)}
              loading={false}
              empty={
                <EmptyState
                  icon={Images}
                  title="Belum ada foto"
                  description="Tambahkan foto produk atau hasil kerja Anda."
                />
              }
            />
            <Button
              leftIcon={Plus}
              loading={uploading}
              variant="secondary"
              onPress={() => void handleUpload()}
            >
              Tambah Foto
            </Button>
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Hapus foto ini?"
        description="Foto akan dihapus dari showcase Anda."
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}
