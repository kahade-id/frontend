import { ListLoading } from "@/components/ui/paginated-list"
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
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChartLine, DeviceMobile, ShieldWarning } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ActivityLogEntry, DeviceSession, SecurityLogEntry } from "@/lib/api/sessions"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import type { Page } from "@/lib/api/response"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { ActivityLogItem } from "@/components/ui/activity-log-item"
import { Button } from "@/components/ui/button"
import { DeviceSessionListItem } from "@/components/ui/device-session-list-item"
import { Dialog } from "@/components/ui/modal"
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
  const sessionsQuery = usePaginatedQuery<DeviceSession>(
    "security-sessions",
    async (page, signal) =>
      listPage((await api.sessions.listSessions({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
  )
  const securityQuery = usePaginatedQuery<SecurityLogEntry>(
    "security-log",
    async (page, signal) =>
      listPage((await api.sessions.getSecurityLog({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
  )
  const activityQuery = usePaginatedQuery<ActivityLogEntry>(
    "activity-log",
    async (page, signal) =>
      listPage((await api.sessions.getActivityLog({ page, limit: PAGE_SIZE }, signal)) ?? [], page),
  )
  const sessions = sessionsQuery.data
  const securityLog = securityQuery.data
  const activityLog = activityQuery.data
  const refreshing =
    sessionsQuery.refreshing || securityQuery.refreshing || activityQuery.refreshing

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<DeviceSession | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const [trustingId, setTrustingId] = useState<string | null>(null)

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
      toast.show({ title: "Gagal mencabut sesi", description: userMessage(err), tone: "danger" })
    } finally {
      setRevokingId(null)
    }
  }, [confirmRevoke, sessionsQuery, toast.show])

  const handleLogoutOthers = useCallback(async () => {
    setRevokingOthers(true)
    try {
      await api.sessions.deleteOtherSessions()
      setConfirmOthers(false)
      await sessionsQuery.refresh()
      toast.show({ title: "Semua perangkat lain dicabut", tone: "success" })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal mencabut sesi lain",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setRevokingOthers(false)
    }
  }, [sessionsQuery, toast.show])

  const handleToggleTrust = useCallback(
    async (session: DeviceSession, next: boolean) => {
      setTrustingId(session.id)
      try {
        if (next) await api.sessions.trustDevice(session.id)
        else await api.sessions.untrustDevice(session.id)
        sessionsQuery.setData((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, trusted: next } : s)),
        )
        toast.show({
          title: next ? "Perangkat ditandai tepercaya" : "Kepercayaan perangkat dicabut",
          description: next ? "Login dari perangkat ini tidak lagi meminta kode 2FA." : undefined,
          tone: "success",
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui perangkat",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setTrustingId(null)
      }
    },
    [toast.show],
  )

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
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl items={TABS} value={tab} onChange={(v) => setTab(v as TabKey)} />

          {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void activeQuery.reload()} />
          ) : loading ? (
            <ListLoading />
          ) : tab === "devices" ? (
            <>
              <SectionHeader title="Perangkat aktif" />
              {sessions.length === 0 ? (
                <EmptyState icon={DeviceMobile} title="Tidak ada sesi aktif" />
              ) : (
                sessions.map((s, i) => (
                  <DeviceSessionListItem
                    key={s.id}
                    deviceName={s.deviceName}
                    client={
                      s.platform ? `${s.platform}${s.browser ? ` · ${s.browser}` : ""}` : undefined
                    }
                    location={s.location}
                    ip={s.ip}
                    lastActiveAt={s.lastActiveAt ? formatDateTime(s.lastActiveAt) : undefined}
                    lastActiveLabel={s.current ? "Aktif sekarang" : undefined}
                    current={s.current}
                    trusted={s.trusted}
                    onToggleTrust={(next) => void handleToggleTrust(s, next)}
                    togglingTrust={trustingId === s.id}
                    onRevoke={s.current ? undefined : () => setConfirmRevoke(s)}
                    revoking={revokingId === s.id}
                    divider={i < sessions.length - 1}
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
              <Button
                variant="ghost"
                onPress={() => setConfirmOthers(true)}
                disabled={otherSessions === 0}
              >
                Keluar dari perangkat lain
              </Button>
            </>
          ) : tab === "security" ? (
            <>
              <SectionHeader title="Log keamanan" />
              {securityLog.length === 0 ? (
                <EmptyState icon={ShieldWarning} title="Belum ada aktivitas keamanan" />
              ) : (
                securityLog.map((l, i) => (
                  <SecurityLogItem
                    key={l.id}
                    title={l.action}
                    ip={l.ip}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < securityLog.length - 1}
                  />
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
            </>
          ) : (
            <>
              <SectionHeader title="Log aktivitas" />
              {activityLog.length === 0 ? (
                <EmptyState icon={ChartLine} title="Belum ada aktivitas" />
              ) : (
                activityLog.map((l, i) => (
                  <ActivityLogItem
                    key={l.id}
                    title={l.action}
                    description={l.description}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < activityLog.length - 1}
                  />
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
        </View>
      </PullToRefresh>

      <Dialog
        title="Cabut sesi ini?"
        description={`${confirmRevoke?.deviceName ?? "Perangkat"} akan diminta masuk kembali.`}
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
        title="Keluar dari semua perangkat lain?"
        description={`${otherSessions} sesi lain akan dicabut dan harus masuk kembali. Perangkat ini tetap masuk.`}
        visible={confirmOthers}
        destructive
        loading={revokingOthers}
        confirmLabel="Keluar dari semua"
        cancelLabel="Batal"
        onConfirm={() => void handleLogoutOthers()}
        onCancel={() => setConfirmOthers(false)}
        onRequestClose={() => setConfirmOthers(false)}
      />
    </Screen>
  )
}