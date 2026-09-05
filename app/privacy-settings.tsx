/**
 * Screen — Privasi Profil (GET/PUT /v1/settings/privacy).
 *
 * Juga: "Minta salinan data saya" → POST /v1/settings/privacy/export
 * (spec 201 tanpa schema; bila respons memuat `url` → buka di browser,
 * selain itu tampilkan pesan bahwa ekspor diproses).
 */
import { useCallback, useEffect, useState } from "react"
import { Linking, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DownloadSimple } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { PrivacySettings } from "@/lib/api/settings"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Header } from "@/components/ui/header"
import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const ITEMS = [
  { key: "profileVisible", title: "Profile terlihat publik", description: "Pengguna lain bisa melihat profil Anda." },
  { key: "showOnlineStatus", title: "Tampilkan status online", description: "Menampilkan indikator online pada profil Anda." },
] as const

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<PrivacySettings>({ profileVisible: true, showOnlineStatus: true })
  const [pending, setPending] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.settings.getPrivacySettings()
      setValue(res ?? { profileVisible: true, showOnlineStatus: true })
    } catch {
      toast.show({ title: "Gagal memuat pengaturan privasi", tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [toast.show])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const handleChange = useCallback(
    async (key: string, next: boolean, all: Partial<Record<string, boolean>>) => {
      setValue((prev) => ({ ...prev, [key]: next, ...all }))
      setPending((p) => [...p, key])
      try {
        await api.settings.updatePrivacySettings({ [key]: next })
        toast.show({ title: "Pengaturan tersimpan", tone: "success", duration: 2500 })
      } catch {
        toast.show({ title: "Gagal menyimpan", tone: "danger" })
      } finally {
        setPending((p) => p.filter((k) => k !== key))
      }
    },
    [toast.show],
  )

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await api.settings.exportPrivacy()
      setExportOpen(false)
      if (res?.url) {
        const ok = await Linking.canOpenURL(res.url)
        if (ok) await Linking.openURL(res.url)
        toast.show({ title: "Ekspor data siap", description: "Berkas dibuka di browser.", tone: "success" })
      } else {
        toast.show({
          title: "Permintaan diterima",
          description: res?.message ?? "Salinan data akan dikirim ke email terdaftar saat siap.",
          tone: "success",
          duration: 4000,
        })
      }
    } catch (err) {
      toast.show({ title: "Gagal meminta ekspor", description: userMessage(err), tone: "danger" })
    } finally {
      setExporting(false)
    }
  }, [exporting, toast])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Privasi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Visibilitas profil" inset />
          <Text variant="body" tone="secondary">
            Atur siapa yang dapat melihat informasi profil Anda.
          </Text>
          <PrivacyToggleList
            items={ITEMS}
            value={value}
            onChange={(k, n, all) => void handleChange(k, n, all)}
            pendingKeys={pending}
            disabled={loading}
          />

          <SectionHeader title="Data pribadi" inset />
          <Text variant="body" tone="secondary">
            Anda berhak meminta salinan seluruh data pribadi yang kami simpan.
          </Text>
          <Button variant="secondary" leftIcon={DownloadSimple} onPress={() => setExportOpen(true)}>
            Minta salinan data saya
          </Button>
        </View>
      </PullToRefresh>

      <Dialog
        title="Minta salinan data?"
        description="Kami akan menyiapkan arsip data akun Anda. Prosesnya bisa memakan waktu; Anda akan diberi tahu saat siap."
        visible={exportOpen}
        loading={exporting}
        confirmLabel="Minta ekspor"
        cancelLabel="Batal"
        onConfirm={() => void handleExport()}
        onCancel={() => setExportOpen(false)}
        onRequestClose={() => setExportOpen(false)}
      />
    </Screen>
  )
}
