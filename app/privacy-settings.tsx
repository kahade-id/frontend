/**
 * Screen — Privasi Profil (GET/PUT /v1/settings/privacy).
 *
 * Juga: "Minta salinan data saya" → POST /v1/settings/privacy/export
 * (spec 201 tanpa schema; bila respons memuat `url` → buka di browser,
 * selain itu tampilkan pesan bahwa ekspor diproses).
 *
 * Audit (P1): versi sebelumnya menginisialisasi state dengan
 * `{ profileVisible: true, showOnlineStatus: true }` dan, saat GET gagal,
 * hanya memunculkan toast lalu MERENDER default itu. Layar privasi kemudian
 * menyatakan "profil terlihat publik: aktif" tanpa pernah membacanya dari
 * server — klaim yang salah tentang data pribadi, bukan sekadar bug tampilan.
 * Sekarang kegagalan muat menghasilkan <ErrorState> + retry (via <DataScreen>)
 * dan tidak ada nilai default yang ditampilkan sebagai fakta.
 */
import { useCallback, useState } from "react"
import { Linking } from "react-native"
import { DownloadSimple } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { PrivacySettings } from "@/lib/api/settings"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const ITEMS = [
  {
    key: "profileVisible",
    title: "Profile terlihat publik",
    description: "Pengguna lain bisa melihat profil Anda.",
  },
  {
    key: "showOnlineStatus",
    title: "Tampilkan status online",
    description: "Menampilkan indikator online pada profil Anda.",
  },
] as const

export default function PrivacySettingsScreen() {
  const toast = useToast()
  // Partial: server boleh mengirim subset; UI tidak boleh mengarang default.
  const query = useApiQuery<Partial<PrivacySettings>>("privacy-settings", () =>
    api.settings.getPrivacySettings().then((res) => res ?? {}),
  )
  const value: Partial<PrivacySettings> = query.data ?? {}
  const { setData } = query

  const [pending, setPending] = useState<string[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleChange = useCallback(
    async (key: string, next: boolean, all: Partial<Record<string, boolean>>) => {
      const previous = (value as Record<string, boolean | undefined>)[key]
      setData((prev) => ({ ...(prev ?? {}), ...all, [key]: next }))
      setPending((p) => [...p, key])
      try {
        await api.settings.updatePrivacySettings({ [key]: next })
        toast.show({ title: "Pengaturan tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        // Rollback ke nilai server terakhir yang diketahui — bukan negasi
        // nilai baru: keduanya berbeda bila `all` mengubah lebih dari satu key.
        setData((prev) => ({ ...(prev ?? {}), [key]: previous }))
        toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
      } finally {
        setPending((p) => p.filter((k) => k !== key))
      }
    },
    [value, setData, toast.show],
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
        toast.show({
          title: "Ekspor data siap",
          description: "Berkas dibuka di browser.",
          tone: "success",
        })
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
    <>
      <DataScreen title="Privasi" state={query} loadingMessage="Memuat pengaturan privasi…">
        <SectionHeader title="Visibilitas profil" />
        <Text variant="body" tone="secondary">
          Atur siapa yang dapat melihat informasi profil Anda.
        </Text>
        <PrivacyToggleList
          items={ITEMS}
          value={value}
          onChange={(k, n, all) => void handleChange(k, n, all)}
          pendingKeys={pending}
        />

        <SectionHeader title="Data pribadi" />
        <Text variant="body" tone="secondary">
          Anda berhak meminta salinan seluruh data pribadi yang kami simpan.
        </Text>
        <Button variant="secondary" leftIcon={DownloadSimple} onPress={() => setExportOpen(true)}>
          Minta salinan data saya
        </Button>
      </DataScreen>

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
    </>
  )
}
