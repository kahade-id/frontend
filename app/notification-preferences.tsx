/**
 * Screen — Pengaturan Notifikasi: Perangkat ini + Server dalam satu layar.
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
import { Platform, View } from "react-native"
import { CaretRight } from "phosphor-react-native"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"
import { isTimeInRange } from "@/lib/time-input"
import { isWebPushConfigured } from "@/lib/web-push-config"
import { registerWebPushDevice } from "@/lib/web-push"
import { getDevicePushPermissionGranted, registerPushDevice } from "@/lib/push-notifications"
import { SecureKeys, getSecureItem } from "@/lib/secure-storage"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { DeviceNotificationSettings } from "@/components/ui/device-notification-settings"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import {
  NotificationPreferencesMatrix,
  type NotificationPreferenceKey,
  type NotificationPreferences as MatrixPreferences,
} from "@/components/ui/notification-preferences-matrix"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TimePickerSheet } from "@/components/ui/time-picker-sheet"
import { useToast } from "@/components/ui/toast"
import type { DigestFrequency } from "@/lib/api/notifications"
import { formatDateTime } from "@/lib/format"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

export default function NotificationPreferencesScreen() {
  useLanguage()
  const toast = useToast()
  const query = useApiQuery<import("@/lib/api/notifications").NotificationPreferences>(
    "notification-preferences",
    (signal) => api.notifications.getNotificationPreferences(signal).then((res) => res ?? {}),
  )
  const value: MatrixPreferences = query.data ?? {}
  const { setData } = query

  // FE-IMP-3 #94 — izin notifikasi perangkat saat ini (dibaca SEKALI saat
  // mount, TANPA meminta — getDevicePushPermissionGranted tidak memicu
  // prompt). Dipakai matriks untuk status efektif gabungan per jenis
  // notifikasi (perangkat + server). `null` = belum diketahui / tidak
  // didukung — tidak memblokir status server.
  const [devicePushGranted, setDevicePushGranted] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    void getDevicePushPermissionGranted().then((granted) => {
      if (alive) setDevicePushGranted(granted)
    })
    return () => {
      alive = false
    }
  }, [])

  // P1-2 (audit FCM 2026-10-03): token terdaftar lokal?
  // Izin OS granted tapi tidak ada token tersimpan = registrasi tidak pernah
  // terjadi (mis. user menolak di rationale sheet awal) → tampilkan CTA
  // "Aktifkan notifikasi" di bawah.
  const [hasLocalPushToken, setHasLocalPushToken] = useState<boolean | null>(null)
  const [activatingPush, setActivatingPush] = useState(false)
  const refreshLocalPushToken = useCallback(() => {
    let alive = true
    void getSecureItem(SecureKeys.pushToken)
      .then((t) => {
        if (alive) setHasLocalPushToken(!!t)
      })
      .catch(() => {
        if (alive) setHasLocalPushToken(false)
      })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => refreshLocalPushToken(), [refreshLocalPushToken])

  const handleActivatePush = useCallback(async () => {
    if (activatingPush) return
    setActivatingPush(true)
    try {
      const deviceApi = {
        registerDevice: (body: Parameters<typeof api.notifications.registerDevice>[0]) =>
          api.notifications.registerDevice(body),
        unregisterDevice: (deviceId: string) => api.notifications.unregisterDevice(deviceId),
      }
      await registerPushDevice(deviceApi, { force: true })
      setHasLocalPushToken(true)
      toast.show({ title: translate("Notifikasi diaktifkan"), tone: "success", duration: 2500 })
    } catch {
      toast.show({
        title: translate("Gagal mengaktifkan notifikasi"),
        description: translate("Coba lagi nanti."),
        tone: "danger",
      })
    } finally {
      setActivatingPush(false)
    }
  }, [activatingPush, toast])

  // CN-008: kirim timezone perangkat sekali saat preferensi dimuat,
  // agar quiet hours dievaluasi di zona waktu pengguna, bukan selalu WIB.
  const prefsTz = query.data?.quietHoursTimezone
  useEffect(() => {
    if (query.data) {
      void api.notifications.syncQuietHoursTimezone(prefsTz ?? null)
    }
  }, [query.data])

  const handleChange = useCallback(
    async (next: MatrixPreferences, key: NotificationPreferenceKey) => {
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

  /**
   * Item #25 — simpan frekuensi digest (PUT /v1/notifications/preferences).
   * Pola yang sama dengan handleChange: optimistis + rollback ke NILAI
   * SEBELUMNYA bila gagal. Dibaca dari `query.data` (tipe API penuh), bukan
   * `value` (matriks boolean-only).
   */
  const handleDigestChange = useCallback(
    async (next: DigestFrequency) => {
      const previous = query.data?.digestFrequency ?? "off"
      setData({ ...value, digestFrequency: next })
      try {
        await api.notifications.updateNotificationPreferences({ digestFrequency: next })
        toast.show({ title: "Preferensi tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        setData((prev) => ({ ...(prev ?? {}), digestFrequency: previous }))
        toast.show({
          title: "Gagal menyimpan preferensi",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [query.data, value, setData, toast.show],
  )

  /**
   * Item #26 — simpan jadwal jangan-ganggu (PUT /v1/notifications/preferences).
   * Pola sama dengan handleChange: optimistis + rollback ke NILAI SEBELUMNYA
   * bila gagal, supaya toggle/jam tidak desinkron dengan server.
   */
  const handleQuietHours = useCallback(
    async (patch: QuietHoursPatch) => {
      // Dibaca dari `query.data` (tipe API penuh), bukan `value` (matriks
      // boolean-only) — field quiet hours tidak ada di tipe matriks.
      const apiPrefs = query.data
      const previous: QuietHoursPatch = {
        quietHoursEnabled: apiPrefs?.quietHoursEnabled,
        quietHoursStart: apiPrefs?.quietHoursStart,
        quietHoursEnd: apiPrefs?.quietHoursEnd,
      }
      setData({ ...value, ...patch })
      try {
        await api.notifications.updateNotificationPreferences(patch)
        toast.show({ title: "Preferensi tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        setData((prev) => ({ ...(prev ?? {}), ...previous }))
        toast.show({
          title: "Gagal menyimpan preferensi",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [query.data, value, setData, toast.show],
  )

  return (
    <DataScreen
      title={translate("Pengaturan Notifikasi")}
      state={query}
      loadingMessage="Memuat preferensi server…"
      persistent={
        <View className="gap-4 pt-3">
          <DeviceNotificationSettings />
          {devicePushGranted === true && hasLocalPushToken === false ? (
            <Alert
              tone="warning"
              title={translate("Notifikasi belum aktif di perangkat ini")}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  loading={activatingPush}
                  disabled={activatingPush}
                  onPress={() => void handleActivatePush()}
                >
                  {translate("Aktifkan notifikasi")}
                </Button>
              }
            >
              {translate(
                "Izin sudah diberikan, tetapi perangkat belum terdaftar untuk menerima push. Ketuk tombol di bawah untuk mengaktifkan.",
              )}
            </Alert>
          ) : null}
          <WebPushOptIn />
          <SectionHeader
            title={translate("Server")}
            subtitle={translate("Kanal dan kiriman notifikasi di semua perangkat, termasuk saat aplikasi tertutup. Perubahan disimpan otomatis.")}
          />
        </View>
      }
    >
      <NotificationPreferencesMatrix
        value={value}
        onChange={(n, k) => void handleChange(n, k)}
        // Keamanan akun tidak boleh dimatikan total: peringatan login baru,
        // perubahan kata sandi, dan 2FA adalah §14 — selalu aktif.
        lockedKeys={["securityInApp", "securityPush"]}
        // FE-IMP-3 #94: status efektif gabungan per jenis (perangkat + server).
        devicePushGranted={devicePushGranted}
      />
      <DigestSection
        frequency={query.data?.digestFrequency ?? "off"}
        lastSentAt={query.data?.lastDigestSentAt ?? null}
        onChange={(next) => void handleDigestChange(next)}
      />
      <QuietHoursSection
        enabled={query.data?.quietHoursEnabled ?? false}
        start={query.data?.quietHoursStart ?? "22:00"}
        end={query.data?.quietHoursEnd ?? "06:00"}
        timezone={query.data?.quietHoursTimezone}
        onSave={(patch) => handleQuietHours(patch)}
      />
    </DataScreen>
  )
}

const DIGEST_OPTIONS: DigestFrequency[] = ["off", "daily", "weekly"]

/**
 * Label/descriptif opsi digest — literal ditulis LANGSUNG di dalam
 * translate() (bukan via variabel) agar generator katalog i18n
 * (scripts/gen-i18n-catalog.mjs) memungutnya.
 */
function digestLabel(value: DigestFrequency): string {
  return translate(value === "daily" ? "Harian" : value === "weekly" ? "Mingguan" : "Mati")
}

function digestDescription(value: DigestFrequency): string {
  return translate(
    value === "daily"
      ? "Terima satu ringkasan notifikasi setiap hari."
      : value === "weekly"
        ? "Terima satu ringkasan notifikasi setiap minggu."
        : "Notifikasi dikirim seperti biasa, tanpa ringkasan.",
  )
}

/**
 * Item #25 — pilihan frekuensi ringkasan (digest) notifikasi.
 * "off" (default) = perilaku lama. Menampilkan waktu kirim terakhir bila ada.
 */
function DigestSection({
  frequency,
  lastSentAt,
  onChange,
}: {
  frequency: DigestFrequency
  lastSentAt: string | null
  onChange: (next: DigestFrequency) => void
}) {
  // Berlangganan bahasa agar label ikut ter-render ulang saat ganti bahasa.
  useLanguage()
  return (
    <>
      <SectionHeader
        title={translate("Ringkasan notifikasi")}
        subtitle={translate("Kumpulkan notifikasi menjadi satu ringkasan berkala.")}
      />
      <RadioGroup
        accessibilityLabel={translate("Frekuensi ringkasan notifikasi")}
        value={frequency}
        onChange={(v) => onChange(v as DigestFrequency)}
        variant="card"
      >
        {DIGEST_OPTIONS.map((opt) => (
          <Radio key={opt} value={opt} label={digestLabel(opt)} description={digestDescription(opt)} />
        ))}
      </RadioGroup>
      {frequency !== "off" && lastSentAt ? (
        <Text variant="caption" tone="secondary">
          {translate("Ringkasan terakhir dikirim {x}", { x: formatDateTime(lastSentAt) })}
        </Text>
      ) : null}
    </>
  )
}

/** Bentuk patch jadwal jangan-ganggu untuk PUT /v1/notifications/preferences. */
type QuietHoursPatch = {
  quietHoursEnabled?: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
}

/** true bila "sekarang" (zona perangkat) masuk rentang [start, end). */
export function isQuietHoursActive(start: string, end: string, now = new Date()): boolean {
  return isTimeInRange(start, end, now)
}

function QuietHoursSection({
  enabled,
  start,
  end,
  timezone,
  onSave,
}: {
  enabled: boolean
  start: string
  end: string
  timezone?: string | null
  onSave: (patch: QuietHoursPatch) => void
}) {
  const [picker, setPicker] = useState<"start" | "end" | null>(null)
  const deviceTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return null
    }
  })()
  const tz = timezone || deviceTz
  const activeNow = enabled && isQuietHoursActive(start, end)

  return (
    <View className="gap-3">
      <SectionHeader
        title={translate("Jangan ganggu")}
        subtitle={translate("Jadwal harian tanpa bunyi notifikasi push.")}
      />
      <View className="gap-1 rounded-lg border border-border bg-surface p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text variant="body" weight={600} tone="primary">
              {translate("Aktifkan jadwal")}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate("Push tidak dibunyikan pada jam berikut.")}
            </Text>
          </View>
          <Switch
            value={enabled}
            onChange={(next) => onSave({ quietHoursEnabled: next })}
            accessibilityLabel={translate("Aktifkan jadwal jangan-ganggu")}
          />
        </View>
        {enabled ? (
          <View className="mt-3 gap-2 border-t border-border pt-3">
            <TimeRow
              label={translate("Mulai")}
              value={start}
              onPress={() => setPicker("start")}
            />
            <TimeRow
              label={translate("Selesai")}
              value={end}
              onPress={() => setPicker("end")}
            />
            <View className="flex-row items-center justify-between">
              <Text variant="caption" tone="secondary">
                {translate("Zona waktu: {x}", { x: tz ?? "—" })}
              </Text>
              <Badge tone={activeNow ? "success" : "neutral"} variant="soft">
                {activeNow ? translate("Aktif sekarang") : translate("Tidak aktif")}
              </Badge>
            </View>
          </View>
        ) : null}
      </View>
      <TimePickerSheet
        visible={picker !== null}
        onRequestClose={() => setPicker(null)}
        title={picker === "start" ? translate("Jam mulai") : translate("Jam selesai")}
        value={picker === "start" ? start : end}
        onSelect={(next) =>
          onSave(picker === "start" ? { quietHoursStart: next } : { quietHoursEnd: next })
        }
      />
    </View>
  )
}

function TimeRow({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="flex-row items-center justify-between rounded-lg bg-background px-3 py-2.5"
    >
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <View className="flex-row items-center gap-1">
        <Text variant="body" weight={600} tone="primary" className="tabular-nums">
          {value}
        </Text>
        <Icon icon={CaretRight} size="sm" tone="default" />
      </View>
    </PressableScale>
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
          unregisterDevice: (deviceId: string) =>
            api.notifications.unregisterDevice(deviceId),
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
