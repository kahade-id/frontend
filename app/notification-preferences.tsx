/**
 * Screen — Preferensi Notifikasi (GET/PUT /v1/notifications/preferences).
 * Matriks kategori × kanal dari NotificationPreferencesMatrix.
 *
 * Audit:
 *   - Loading dan error sebelumnya dirender sebagai <Text numberOfLines={1}> polos: tidak ada
 *     tombol "Coba lagi", tidak ada role alert, dan gagal-muat terlihat sama
 *     seperti "preferensi memang kosong". Sekarang memakai kerangka
 *     <DataScreen> (LoadingScreen / ErrorState + retry) seperti layar lain.
 *   - Toggle memakai `query.setData` sebagai sumber tunggal (tidak ada salinan
 *     state kedua yang bisa desinkron dengan hasil refresh), dan rollback
 *     mengembalikan NILAI SEBELUMNYA, bukan negasi nilai baru.
 *   - Pesan gagal simpan menyertakan `userMessage(err)` dari backend.
 */
import { useCallback, useEffect, useState } from "react"
import { Platform } from "react-native"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"
import { isWebPushConfigured } from "@/lib/web-push-config"
import { registerWebPushDevice } from "@/lib/web-push"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import {
  NotificationPreferencesMatrix,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/components/ui/notification-preferences-matrix"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function NotificationPreferencesScreen() {
  const toast = useToast()
  const query = useApiQuery<NotificationPreferences>("notification-preferences", (signal) =>
    api.notifications.getNotificationPreferences(signal).then((res) => res ?? {}),
  )
  const value = query.data ?? {}
  const { setData } = query

  const handleChange = useCallback(
    async (next: NotificationPreferences, key: NotificationPreferenceKey) => {
      const previous = value[key]
      setData(next)
      try {
        await api.notifications.updateNotificationPreferences({ [key]: next[key] })
        toast.show({ title: "Preferensi tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        setData((prev) => ({ ...(prev ?? {}), [key]: previous }))
        toast.show({
          title: "Gagal menyimpan preferensi",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [value, setData, toast.show],
  )

  return (
    <DataScreen
      title="Preferensi Notifikasi"
      state={query}
      loadingMessage="Memuat preferensi…"
    >
      <WebPushOptIn />
      <Text variant="body" tone="secondary">
        Pilih kanal notifikasi untuk setiap kategori. Perubahan disimpan otomatis.
      </Text>
      <NotificationPreferencesMatrix
        value={value}
        onChange={(n, k) => void handleChange(n, k)}
      />
    </DataScreen>
  )
}

/**
 * Opt-in FCM Web Push — HANYA web, dan hanya bila relevan.
 *
 * Pengguna yang melewati/menolak izin di Welcome tidak punya jalan kembali
 * tanpa ini: browser tidak mengizinkan app meminta ulang izin secara
 * programatik setelah ditolak (harus lewat site settings), dan Welcome tidak
 * dikunjungi lagi setelah login. Kartu ini adalah satu-satunya tempat
 * re-aktivasi — kembalian `null` di semua kasus lain (native, build tanpa
 * env Firebase, browser tanpa Notification/secure context, atau izin sudah
 * granted) supaya tidak menjadi noise.
 *
 * Status izin dibaca di effect (client-only): `Notification` tidak ada saat
 * prerender SSR, dan membaca `permission` saat render akan merusak
 * konsistensi server/client.
 */
type WebPushOptInState = "checking" | "unsupported" | "default" | "denied" | "granted"

function WebPushOptIn() {
  const toast = useToast()
  const [state, setState] = useState<WebPushOptInState>("checking")
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "web" || !isWebPushConfigured()) {
      setState("unsupported")
      return
    }
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !window.isSecureContext
    ) {
      setState("unsupported")
      return
    }
    setState(window.Notification.permission)
  }, [])

  const handleEnable = useCallback(async () => {
    setEnabling(true)
    try {
      const token = await registerWebPushDevice(
        {
          registerDevice: (dto) => api.notifications.registerDevice(dto),
          unregisterDevice: () => api.notifications.unregisterDevice(),
        },
        { force: true },
      )
      if (token) {
        setState("granted")
        toast.show({ title: "Notifikasi browser aktif", tone: "success", duration: 2500 })
        return
      }
      const permission =
        typeof window !== "undefined" && "Notification" in window
          ? window.Notification.permission
          : "denied"
      setState(permission)
      if (permission !== "granted") {
        toast.show({
          title: "Gagal mengaktifkan notifikasi",
          description: "Izin notifikasi diperlukan agar Kahade dapat memberi tahu Anda.",
          tone: "danger",
        })
      }
    } catch (err) {
      toast.show({
        title: "Gagal mengaktifkan notifikasi",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setEnabling(false)
    }
  }, [toast])

  if (state === "checking" || state === "unsupported" || state === "granted") return null

  if (state === "denied") {
    return (
      <Alert tone="danger" title="Notifikasi browser diblokir">
        Izin notifikasi ditolak untuk situs ini. Klik ikon kunci di address bar, ubah Notifikasi
        menjadi Izinkan, lalu muat ulang halaman.
      </Alert>
    )
  }

  return (
    <Alert
      tone="neutral"
      title="Notifikasi browser"
      action={
        <Button size="sm" variant="secondary" loading={enabling} onPress={() => void handleEnable()}>
          Aktifkan
        </Button>
      }
    >
      Aktifkan agar status order, pembayaran, dan sengketa penting muncul sebagai notifikasi
      browser, walau tab Kahade tidak sedang dibuka.
    </Alert>
  )
}
