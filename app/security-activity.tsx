/**
 * Screen — Perangkat & Aktivitas: perangkat aktif (sessions), log keamanan,
 * log aktivitas.
 *
 * Dipindah dari `/security`: menu Pengaturan → Keamanan sekarang membuka PUSAT
 * pengaturan keamanan (ganti nomor HP/email/password/PIN, biometrik, 2FA,
 * privasi) di `app/security.tsx`, dan layar ini menjadi salah satu barisnya
 * ("Perangkat & Log"). Isi & endpoint tidak berubah.
 *
 * Endpoint (lib/api/sessions.ts):
 *   GET    /v1/sessions?page&limit               daftar sesi
 *   DELETE /v1/sessions/{id} · /v1/sessions/others
 *   PATCH  /v1/users/me/devices/{id}/trust|untrust  perangkat tepercaya (lewati 2FA)
 *   GET    /v1/users/me/security-log?page&limit&action
 *   GET    /v1/users/me/activity-log?page&limit
 *
 * Keputusan non-obvious:
 *   - `trusted === false` BUKAN "mencurigakan": itu status default semua
 *     perangkat yang belum ditandai tepercaya. Versi lama menandai hampir
 *     semua sesi "Perlu ditinjau". Sekarang `trusted` dirender sebagai badge
 *     + aksi Percayai/Cabut kepercayaan; `suspicious` tidak dikirim karena
 *     API tidak menyediakan sinyalnya.
 *   - Tiga daftar dipaginasi terpisah (`page` per tab) dengan <LoadMore>;
 *     PullToRefresh mereset ketiganya ke halaman 1.
 *   - Tab "Keluar dari perangkat lain" memakai Dialog konfirmasi: mencabut
 *     semua sesi lain berdampak ke perangkat yang tidak terlihat di layar.
 */

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { memo, useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { ChartLine, DeviceMobile, ShieldWarning } from "phosphor-react-native"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { unregisterPushDevice } from "@/lib/push-notifications"
import type { ActivityLogEntry, DeviceSession, SecurityLogEntry } from "@/lib/api/sessions"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import type { Page } from "@/lib/api/response"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"

import { ActivityLogItem } from "@/components/ui/activity-log-item"
import { Button } from "@/components/ui/button"
import { DeviceSessionListItem, type DevicePlatform } from "@/components/ui/device-session-list-item"
import { Dialog } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SecurityLogItem } from "@/components/ui/security-log-item"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useToast } from "@/components/ui/toast"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { showMutationError } from "@/lib/mutation-toast"

type TabKey = "devices" | "security" | "activity"

const TABS = [
  { value: "devices", label: "Perangkat" },
  { value: "security", label: "Keamanan" },
  { value: "activity", label: "Aktivitas" },
] as const satisfies ReadonlyArray<{ value: TabKey; label: string }>

const PAGE_SIZE = 20

/**
 * Ketiga endpoint daftar di layar ini mengembalikan ARRAY POLOS tanpa `meta`
 * — itulah sebabnya kode lama menulis "API list tanpa meta".
 * `usePaginatedQuery` menghitung `page < meta.totalPages`, dan tanpa
 * `totalPages` perbandingan itu `page < undefined` = false sehingga tombol
 * muat-lanjut lenyap tanpa pesan. Aturan lama ("halaman < PAGE_SIZE berarti
 * sudah habis") direplikasi di sini sebagai `totalPages` sintetis.
 */
function listPage<T extends { id: string }>(rows: T[], page: number): Page<T> {
  return {
    data: rows,
    meta: {
      page,
      limit: PAGE_SIZE,
      totalPages: rows.length >= PAGE_SIZE ? page + 1 : page,
    },
  }
}

/**
 * FE-011 (audit 2026-09-29): baris-baris di-memo — handler inline di `.map`
 * (`onToggleTrust={(next) => ...}`, `onRevoke={() => ...}`,
 * `onLongPress={() => ...}`) me-render ulang seluruh daftar tiap interaksi.
 * Closure kini dibuat stabil di dalam baris sendiri (useCallback per item)
 * dari handler stabil level layar, sehingga satu aksi hanya me-render ulang
 * baris yang berubah (identitas objek item dipertahankan `usePaginatedQuery`).
 */

/**
 * BFE-046: tampilkan info perangkat bila ada — string wire `platform`
 * (bebas, dari backend) dipetakan ke union `DevicePlatform` komponen agar
 * ikon perangkat benar; nilai tak dikenal → undefined (komponen memakai
 * default "mobile").
 */
function toDevicePlatform(raw?: string): DevicePlatform | undefined {
  const key = raw?.trim().toLowerCase()
  return key === "mobile" ||
    key === "tablet" ||
    key === "laptop" ||
    key === "desktop" ||
    key === "web"
    ? key
    : undefined
}

const DeviceSessionRow = memo(function DeviceSessionRow({
  session,
  divider,
  togglingTrust,
  revoking,
  onToggleTrust,
  onRequestRevoke,
  onRequestRemove,
}: {
  session: DeviceSession
  divider: boolean
  togglingTrust: boolean
  revoking: boolean
  onToggleTrust: (session: DeviceSession, next: boolean) => void
  onRequestRevoke: (session: DeviceSession) => void
  onRequestRemove: (session: DeviceSession) => void
}) {
  const s = session
  const handleToggleTrust = useCallback((next: boolean) => onToggleTrust(s, next), [s, onToggleTrust])
  const handleRevoke = useCallback(() => onRequestRevoke(s), [s, onRequestRevoke])
  const handleLongPress = useCallback(() => onRequestRemove(s), [s, onRequestRemove])
  return (
    <DeviceSessionListItem
      deviceName={s.deviceName}
      platform={toDevicePlatform(s.platform)}
      client={s.platform ? `${s.platform}${s.browser ? ` · ${s.browser}` : ""}` : undefined}
      location={s.location}
      ip={s.ip}
      lastActiveAt={s.lastActiveAt ? formatDateTime(s.lastActiveAt) : undefined}
      lastActiveLabel={s.current ? "Aktif sekarang" : undefined}
      current={s.current}
      trusted={s.trusted}
      onToggleTrust={handleToggleTrust}
      togglingTrust={togglingTrust}
      onRevoke={s.current ? undefined : handleRevoke}
      revoking={revoking}
      onLongPress={s.current || !s.deviceId ? undefined : handleLongPress}
      divider={divider}
    />
  )
})

const SecurityLogRow = memo(function SecurityLogRow({
  entry,
  divider,
}: {
  entry: SecurityLogEntry
  divider: boolean
}) {
  return (
    <SecurityLogItem
      title={entry.action}
      ip={entry.ip}
      timestamp={formatDateTime(entry.createdAt)}
      divider={divider}
    />
  )
})

const ActivityLogRow = memo(function ActivityLogRow({
  entry,
  divider,
}: {
  entry: ActivityLogEntry
  divider: boolean
}) {
  return (
    <ActivityLogItem
      title={entry.action}
      description={entry.description}
      timestamp={formatDateTime(entry.createdAt)}
      divider={divider}
    />
  )
})

export default function SecurityActivityScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [tab, setTab] = useState<TabKey>("devices")

  /**
   * Audit — layar ini merakit tiga paginator manual sekaligus (PagedList +
   * appendPage + loadSessions/loadSecurity/loadActivity). Diganti tiga
   * `usePaginatedQuery`, satu per daftar. Cacat terbukti dari kode lama:
   *
   *   1. BLANKING. `handleRefresh` memanggil `fetchAll()` yang sama dengan
   *      muat-awal, dan fungsi itu membuka dengan `setLoading(true)` —
   *      tarik-untuk-menyegarkan mengganti ketiga daftar dengan kerangka.
   *   2. TIDAK ADA GUARD STALE-RESPONSE. Layar ini tidak punya satu pun
   *      `useRef`/`AbortController`, dan `<PullToRefresh>` di sini tidak
   *      memasang `enabled`, jadi menarik saat muat-awal masih berjalan
   *      mengirim `fetchAll()` kedua. `finally` milik request pertama lalu
   *      menjalankan `setLoading(false)` sementara request kedua masih
   *      berjalan — kerangka hilang di tengah muat.
   *   3. ERROR SESI MEMBLOKIR TAB LAIN. Cabang `error` lama diperiksa
   *      SEBELUM percabangan tab, padahal hanya `loadSessions` yang mengisi
   *      `error` (kedua log di-`.catch()` karena "sekunder"). Akibatnya satu
   *      kegagalan `/v1/sessions` menyembunyikan log keamanan DAN log
   *      aktivitas yang berhasil dimuat. Kini tiap tab punya error sendiri.
   *   4. `loadMore` tidak single-flight: dua tap cepat = dua request.
   *
   * Ketiga daftar tetap dimuat saat mount, persis seperti `Promise.all` lama.
   */
  /**
   * C-08 (audit): ketiga daftar di layar ini kronologis — perangkat/log
   * terbaru harus di atas. Tanpa pembanding, baris lama mempertahankan posisi
   * hasil unduhan pertama walau server sudah mengurutkan ulang.
   */
  const sessionsQuery = usePaginatedQuery<DeviceSession>(
    "security-sessions",
    async (page, signal) =>
      listPage((await api.sessions.listSessions({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
    { compare: byTimestampDesc<DeviceSession>((session) => session.lastActiveAt) },
  )
  const securityQuery = usePaginatedQuery<SecurityLogEntry>(
    "security-log",
    async (page, signal) =>
      listPage((await api.sessions.getSecurityLog({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
    { compare: byTimestampDesc<SecurityLogEntry>((entry) => entry.createdAt) },
  )
  const activityQuery = usePaginatedQuery<ActivityLogEntry>(
    "activity-log",
    async (page, signal) =>
      listPage((await api.sessions.getActivityLog({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
    { compare: byTimestampDesc<ActivityLogEntry>((entry) => entry.createdAt) },
  )
  const sessions = sessionsQuery.data
  const securityLog = securityQuery.data
  const activityLog = activityQuery.data
  const refreshing =
    sessionsQuery.refreshing || securityQuery.refreshing || activityQuery.refreshing

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [trustingId, setTrustingId] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<DeviceSession | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [revokingAll, setRevokingAll] = useState(false)
  // A09 (batch 139): "Keluar dari semua perangkat" ikut mencabut SESI AKTIF
  // (perangkat ini) — butuh konfirmasi ULANG (ketuk dua kali), bukan satu
  // ketukan. State armed direset setiap dialog ditutup.
  const [confirmAllArmed, setConfirmAllArmed] = useState(false)
  const closeConfirmAll = useCallback(() => {
    setConfirmAll(false)
    setConfirmAllArmed(false)
  }, [])
  const [removeTarget, setRemoveTarget] = useState<DeviceSession | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  /** Tarik-untuk-menyegarkan memuat ulang KETIGA daftar, seperti Promise.all lama. */
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      sessionsQuery.refresh(),
      securityQuery.refresh(),
      activityQuery.refresh(),
    ])
  }, [sessionsQuery, securityQuery, activityQuery])

  const handleRevoke = useCallback(async () => {
    if (!confirmRevoke) return
    setRevokingId(confirmRevoke.id)
    try {
      await api.sessions.deleteSession(confirmRevoke.id)
      sessionsQuery.setData((prev) => prev.filter((s) => s.id !== confirmRevoke.id))
      toast.show({ title: "Sesi dicabut", tone: "success" })
      setConfirmRevoke(null)
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: "Gagal mencabut sesi",
        uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
        err: err,
        scope: "security-activity:mencabut-sesi",
      })
      void sessionsQuery.reload()
    } finally {
      setRevokingId(null)
    }
  }, [confirmRevoke, sessionsQuery, toast.show])

  /**
   * Hapus/lupakan perangkat (DELETE /v1/users/me/devices/{deviceId}) — beda
   * dari cabut sesi: backend mencabut SEMUA sesi perangkat itu sekaligus dan
   * menghapus catatannya, sehingga perangkat harus login ulang + 2FA lagi.
   * Dipicu tekan-lama baris (bukan tombol) agar tidak bercampur dengan aksi
   * "Keluar" yang lebih ringan.
   */
  const handleRemoveDevice = useCallback(async () => {
    if (!removeTarget?.deviceId) return
    setRemovingId(removeTarget.id)
    try {
      await api.users.removeDevice(removeTarget.deviceId)
      sessionsQuery.setData((prev) => prev.filter((s) => s.id !== removeTarget.id))
      toast.show({ title: "Perangkat dihapus", tone: "success" })
      setRemoveTarget(null)
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: "Gagal menghapus perangkat",
        uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
        err: err,
        scope: "security-activity:menghapus-perangkat",
      })
      void sessionsQuery.reload()
    } finally {
      setRemovingId(null)
    }
  }, [removeTarget, sessionsQuery, toast.show])

  const handleLogoutOthers = useCallback(async () => {
    setRevokingOthers(true)
    try {
      await api.sessions.deleteOtherSessions()
      setConfirmOthers(false)
      await sessionsQuery.refresh()
      toast.show({ title: "Semua perangkat lain dicabut", tone: "success" })
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mencabut sesi lain",
          uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
          err: err,
          scope: "security-activity:mencabut-sesi-lain",
        })
      ) {
        void sessionsQuery.refresh()
      }
    } finally {
      setRevokingOthers(false)
    }
  }, [sessionsQuery, toast.show])

  /**
   * Cabut SEMUA sesi termasuk perangkat ini → paksa logout lokal.
   *
   * Audit Auth 2026-10-10 (#FE-S5): dulu dua langkah — `DELETE /v1/sessions`
   * (yang di backend hanya mencabut sesi LAIN) lalu `logout()` biasa. Bila
   * langkah kedua gagal (offline), sesi perangkat ini tetap hidup di server
   * padahal UI sudah "keluar". Kini SATU panggilan atomik
   * `POST /v1/auth/logout { logoutAll: true }` yang mencabut semua sesi
   * (termasuk ini) + memutus push semua perangkat di server; sesi lokal
   * selalu dibersihkan oleh `api.auth.logout` apa pun hasil servernya
   * (retry + penjadwalan ulang saat offline).
   */
  const handleLogoutAll = useCallback(async () => {
    setRevokingAll(true)
    setConfirmAll(false)
    setConfirmAllArmed(false)
    // P1-1 (audit FCM 2026-10-03): cabut token push SEBELUM sesi lokal
    // dibersihkan — kalau tidak, perangkat tetap menerima push akun ini
    // setelah "cabut semua sesi". Kegagalan unregister tidak boleh
    // menggagalkan logout.
    try {
      await unregisterPushDevice({
        registerDevice: (body) => api.notifications.registerDevice(body),
        unregisterDevice: (deviceId: string) => api.notifications.unregisterDevice(deviceId),
      })
    } catch {
      // diabaikan — logout tetap jalan
    }
    try {
      await api.auth.logout({ logoutAll: true })
    } catch {
      // Sesi lokal sudah dihapus di dalam logout(); kegagalan di sini hanya
      // penanda "signed out" — tetap arahkan ke login.
    } finally {
      setRevokingAll(false)
    }
    router.replace(ROUTES.login)
  }, []),

  /**
   * Trust/untrust menuntut re-auth password (TrustDeviceDto produksi: `password`
   * wajib, `mfaCode` opsional). Dulu dikirim `{}` → 400 selalu; sekarang dialog
   * password ditampilkan dulu, lalu API dipanggil dengan password yang diisi.
   */
  const [trustTarget, setTrustTarget] = useState<{ session: DeviceSession; next: boolean } | null>(null)
  const [trustPassword, setTrustPassword] = useState("")

  const handleToggleTrust = useCallback((session: DeviceSession, next: boolean) => {
    if (!session.deviceId) {
      toast.show({ title: "Status perangkat belum tersedia", tone: "danger" })
      return
    }
    setTrustPassword("")
    setTrustTarget({ session, next })
  }, [toast.show])

  // FE-011: handler stabil per-id untuk baris DeviceSessionRow yang di-memo.
  const requestRevoke = useCallback((s: DeviceSession) => {
    setConfirmRevoke(s)
  }, [])
  const requestRemove = useCallback((s: DeviceSession) => {
    setRemoveTarget(s)
  }, [])

  const handleToggleTrustConfirm = useCallback(async () => {
    const target = trustTarget
    const password = trustPassword.trim()
    if (!target?.session.deviceId || !password) return
    setTrustingId(target.session.id)
    try {
      if (target.next) {
        await api.sessions.trustDevice(target.session.deviceId, { password })
      } else {
        await api.sessions.untrustDevice(target.session.deviceId, { password })
      }
      sessionsQuery.setData((prev) =>
        prev.map((item) => (item.id === target.session.id ? { ...item, trusted: target.next } : item)),
      )
      setTrustTarget(null)
      toast.show({
        title: target.next ? "Perangkat dipercaya" : "Kepercayaan dicabut",
        tone: "success",
      })
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: "Gagal mengubah perangkat tepercaya",
        uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
        err: err,
        scope: "security-activity:mengubah-perangkat-tepercaya",
      })
      void sessionsQuery.reload()
    } finally {
      setTrustingId(null)
    }
  }, [trustTarget, trustPassword, sessionsQuery, toast.show])

  /**
   * `error`/`loading` milik TAB AKTIF saja. Sebelumnya keduanya berasal dari
   * `Promise.all` ketiga daftar, sehingga satu kegagalan `/v1/sessions`
   * menyembunyikan log keamanan dan log aktivitas yang berhasil dimuat.
   */
  const activeQuery =
    tab === "devices" ? sessionsQuery : tab === "security" ? securityQuery : activityQuery
  const { loading, error } = activeQuery

  const otherSessions = sessions.filter((s) => !s.current).length

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Perangkat & Log" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl
            accessibilityLabel="Jenis aktivitas"
            items={TABS}
            value={tab}
            onChange={(v) => setTab(v as TabKey)}
          />

          {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void activeQuery.reload()} />
          ) : (
            // v2: skeleton → isi crossfade; error tetap didahulukan.
            <Crossfade loading={loading} skeleton={<ListLoading />}>
              {tab === "devices" ? (
            <>
              <SectionHeader title="Perangkat aktif" />
              {/* J-12 (audit): konteks risiko — pengguna perlu tahu MENGAPA
                  lokasi/IP/perangkat ditampilkan dan apa tindakan yang bisa
                  diambil bila ada login asing (cabut akses + ganti kata sandi). */}
              <Text variant="caption" tone="secondary" className="text-pretty">
                Periksa perangkat, lokasi, dan alamat IP yang memiliki akses ke
                akun Anda. Melihat aktivitas yang bukan Anda? Cabut akses
                perangkat tersebut, lalu ganti kata sandi dan periksa verifikasi
                dua langkah Anda.
              </Text>
              {sessions.length === 0 ? (
                <EmptyState icon={DeviceMobile} title="Belum ada sesi aktif" />
              ) : (
                sessions.map((s, i) => (
                  <DeviceSessionRow
                    key={s.id}
                    session={s}
                    divider={i < sessions.length - 1}
                    togglingTrust={trustingId === s.id}
                    revoking={revokingId === s.id}
                    onToggleTrust={handleToggleTrust}
                    onRequestRevoke={requestRevoke}
                    onRequestRemove={requestRemove}
                  />
                ))
              )}
              <LoadMore
                status={
                  sessionsQuery.loadingMore
                    ? "loading"
                    : sessionsQuery.loadMoreError
                      ? "error"
                      : sessionsQuery.hasMore
                        ? "idle"
                        : "end"
                }
                errorLabel={sessionsQuery.loadMoreError ?? undefined}
                onLoadMore={() => void sessionsQuery.loadMore()}
                hideEnd
              />
              {/*
               * A10 (batch 139): waktu sesi sudah absolut lokal (§13) +
               * perangkat + lokasi perkiraan. Lokasi ditebak dari IP —
               * jelaskan bisa tidak presisi supaya user tidak panik bila
               * kota sedikit meleset.
               */}
              <Text variant="caption" tone="secondary" className="text-pretty">
                Lokasi diperkirakan dari alamat IP dan bisa tidak presisi.
                Waktu memakai zona waktu perangkat Anda.
              </Text>
              <Button
                variant="ghost"
                onPress={() => setConfirmOthers(true)}
                disabled={otherSessions === 0}
              >
                Keluar dari perangkat lain
              </Button>
              <Button variant="ghost" onPress={() => setConfirmAll(true)}>
                Keluar dari semua perangkat
              </Button>
            </>
          ) : tab === "security" ? (
            <>
              <SectionHeader title="Log keamanan" />
              {securityLog.length === 0 ? (
                <EmptyState icon={ShieldWarning} title="Belum ada aktivitas keamanan" />
              ) : (
                securityLog.map((l, i) => (
                  <SecurityLogRow key={l.id} entry={l} divider={i < securityLog.length - 1} />
                ))
              )}
              <LoadMore
                status={
                  securityQuery.loadingMore
                    ? "loading"
                    : securityQuery.loadMoreError
                      ? "error"
                      : securityQuery.hasMore
                        ? "idle"
                        : "end"
                }
                errorLabel={securityQuery.loadMoreError ?? undefined}
                onLoadMore={() => void securityQuery.loadMore()}
                hideEnd
              />
              {/* A10: waktu absolut memakai zona waktu perangkat. Perangkat &
                  lokasi per entri belum dikembalikan server (parsial). */}
              <Text variant="caption" tone="secondary" className="text-pretty">
                Waktu memakai zona waktu perangkat Anda.
              </Text>
            </>
          ) : (
            <>
              <SectionHeader title="Log aktivitas" />
              {activityLog.length === 0 ? (
                <EmptyState icon={ChartLine} title="Belum ada aktivitas" />
              ) : (
                activityLog.map((l, i) => (
                  <ActivityLogRow key={l.id} entry={l} divider={i < activityLog.length - 1} />
                ))
              )}
              <LoadMore
                status={
                  activityQuery.loadingMore
                    ? "loading"
                    : activityQuery.loadMoreError
                      ? "error"
                      : activityQuery.hasMore
                        ? "idle"
                        : "end"
                }
                errorLabel={activityQuery.loadMoreError ?? undefined}
                onLoadMore={() => void activityQuery.loadMore()}
                hideEnd
              />
            </>
            )}
          </Crossfade>
        )}
        </View>
      </PullToRefresh>

      <Dialog
        title="Cabut sesi ini?"
        description={translate("{x} akan diminta masuk kembali.", {
          x: confirmRevoke?.deviceName ?? "Perangkat",
        })}
        visible={!!confirmRevoke}
        destructive
        loading={revokingId === confirmRevoke?.id}
        confirmLabel="Cabut"
        cancelLabel="Batal"
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevoke(null)}
        onRequestClose={() => setConfirmRevoke(null)}
      />

      <Dialog
        title="Hapus perangkat ini?"
        description={translate(
          "{x} akan dilupakan: semua sesinya dicabut dan perangkat ini harus masuk ulang beserta {y}.",
          { x: removeTarget?.deviceName ?? "Perangkat", y: "2FA" },
        )}
        visible={!!removeTarget}
        destructive
        loading={removingId === removeTarget?.id}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleRemoveDevice()}
        onCancel={() => setRemoveTarget(null)}
        onRequestClose={() => setRemoveTarget(null)}
      />

      <Dialog
        title={trustTarget?.next ? "Percayai perangkat ini?" : "Cabut kepercayaan perangkat?"}
        description={
          trustTarget?.next
            ? "Perangkat tepercaya melewati 2FA saat masuk. Masukkan kata sandi akun untuk konfirmasi."
            : "Perangkat akan kehilangan status tepercaya dan harus melewati 2FA lagi. Masukkan kata sandi akun untuk konfirmasi."
        }
        visible={!!trustTarget}
        destructive={!trustTarget?.next}
        loading={trustingId !== null}
        // FE-116: label konfirmasi eksplisit per aksi (bukan "Konfirmasi" generik).
        confirmLabel={trustTarget?.next ? "Ya, percayai perangkat" : "Ya, cabut kepercayaan"}
        // FE-117: tombol mati saat kata sandi kosong — klik tidak "bisu" lagi.
        confirmButtonProps={{ disabled: !trustPassword.trim() }}
        cancelLabel="Batal"
        onConfirm={() => void handleToggleTrustConfirm()}
        onCancel={() => setTrustTarget(null)}
        onRequestClose={() => setTrustTarget(null)}
      >
        <Input
          value={trustPassword}
          onChangeText={setTrustPassword}
          // FRM-014: field sensitif butuh label terasosiasi, bukan hanya placeholder.
          label="Kata sandi akun"
          placeholder="Kata sandi akun"
          secureTextEntry
          autoComplete="password"
        />
      </Dialog>

      <Dialog
        title="Keluar dari semua perangkat lain?"
        description={translate(
          "{x} sesi lain akan dicabut dan harus masuk kembali. Perangkat ini tetap masuk.",
          { x: otherSessions },
        )}
        visible={confirmOthers}
        destructive
        loading={revokingOthers}
        confirmLabel="Keluar dari semua"
        cancelLabel="Batal"
        onConfirm={() => void handleLogoutOthers()}
        onCancel={() => setConfirmOthers(false)}
        onRequestClose={() => setConfirmOthers(false)}
      />

      <Dialog
        title="Keluar dari semua perangkat?"
        description={translate(
          "Semua sesi termasuk PERANGKAT INI akan dicabut. Anda harus masuk kembali di semua perangkat.",
        )}
        visible={confirmAll}
        destructive
        loading={revokingAll}
        // A09: konfirmasi ulang — ketukan pertama mempersenjatai, ketukan
        // kedua mengeksekusi. Mencegah cabut sesi aktif karena salah ketuk.
        confirmLabel={confirmAllArmed ? "Ketuk lagi untuk mengonfirmasi" : "Ya, keluarkan semua"}
        cancelLabel="Batal"
        onConfirm={() => {
          if (confirmAllArmed) void handleLogoutAll()
          else setConfirmAllArmed(true)
        }}
        onCancel={closeConfirmAll}
        onRequestClose={closeConfirmAll}
      />
    </Screen>
  )
}
