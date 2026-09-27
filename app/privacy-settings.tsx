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
 *
 * GAP-B1 (G076–G083): kontrol granular — visibilitas identitas (G076), daftar
 * follower/following (G077), visibilitas default etalase (G078), kebijakan Q&A
 * (G079–G080), ulasan & statistik tersembunyi (G081–G082), indeks mesin pencari
 * (G083). Nilai enum dikirim apa adanya ke server (PATCH semantics).
 */
import { useCallback, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { CaretRight, DownloadSimple } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import { translate, useLanguage } from "@/lib/i18n"
import { safeHttpsUrl } from "@/lib/version"
import type {
  ConsentHistoryEntry,
  ConsentStatus,
  ConsentType,
  ExportRequestSummary,
  PrivacyListVisibility,
  PrivacySettings,
  QaCommentPolicy,
} from "@/lib/api/settings"
import type { UpdatePrivacyDto } from "@/lib/api/types"
import { useApiQuery } from "@/lib/use-api-query"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Icon } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const ITEMS = [
  {
    key: "profileVisible",
    title: "Profil terlihat publik",
    description: "Pengguna lain bisa melihat profil Anda.",
  },
  {
    key: "showOnlineStatus",
    title: "Tampilkan status online",
    description: "Menampilkan indikator online pada profil Anda.",
  },
] as const

/** G076: visibilitas field identitas akun (berlaku untuk pengunjung profil). */
const IDENTITY_ITEMS = [
  {
    key: "showEmail",
    title: "Tampilkan email akun",
    description: "Pengunjung profil bisa melihat alamat email Anda.",
  },
  {
    key: "showPhone",
    title: "Tampilkan nomor HP",
    description: "Pengunjung profil bisa melihat nomor HP Anda.",
  },
  {
    key: "showDob",
    title: "Tampilkan tanggal lahir",
    description: "Pengunjung profil bisa melihat tanggal lahir Anda.",
  },
  {
    key: "showGender",
    title: "Tampilkan gender",
    description: "Pengunjung profil bisa melihat gender Anda.",
  },
] as const

/** G081: ulasan publik. */
const REVIEW_ITEMS = [
  {
    key: "showReviews",
    title: "Tampilkan ulasan",
    description: "Ulasan dan rating Anda terlihat di profil publik.",
  },
] as const

/** G082: kunci statistik yang bisa disembunyikan (mirror backend KNOWN_HIDDEN_STAT_KEYS). */
const HIDDEN_STAT_ITEMS = [
  { key: "totalOrders", title: "Jumlah transaksi", description: "Sembunyikan total transaksi selesai." },
  { key: "avgRating", title: "Rata-rata rating", description: "Sembunyikan rata-rata rating." },
  { key: "ratingCount", title: "Jumlah rating", description: "Sembunyikan jumlah rating." },
  { key: "memberSince", title: "Tanggal bergabung", description: "Sembunyikan tanggal bergabung." },
] as const

/** G083 + G080: toggle lain. */
const MISC_ITEMS = [
  {
    key: "qaAnswerModeration",
    title: "Moderasi jawaban Q&A",
    description: "Jawaban Q&A baru tidak publik sampai Anda terbitkan.",
  },
  {
    key: "searchEngineIndex",
    title: "Izinkan mesin pencari",
    // FE-IMP-3 #104 — jujur soal propagasi: perubahan butuh beberapa hari
    // untuk tercermin di hasil pencarian (cache perayap, bukan instan).
    description:
      "Profil Anda boleh diindeks mesin pencari. Perubahan membutuhkan beberapa hari untuk berlaku di hasil pencarian.",
  },
] as const

const LIST_VISIBILITY_LABELS: Record<PrivacyListVisibility, string> = {
  EVERYONE: "Semua orang",
  FOLLOWERS: "Pengikut saja",
  ONLY_ME: "Hanya saya",
}

const QA_POLICY_LABELS: Record<QaCommentPolicy, string> = {
  EVERYONE: "Semua orang",
  FOLLOWERS: "Pengikut saja",
  DISABLED: "Nonaktif",
}

const SHOWCASE_VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Publik",
  FOLLOWERS: "Pengikut saja",
  PRIVATE: "Pribadi",
}

type EnumRowProps<T extends string> = {
  title: string
  description: string
  value: T | undefined
  options: readonly T[]
  labels: Record<string, string>
  pending: boolean
  onPick: (next: T) => void
  /**
   * FE-IMP-3 #100 — label default backend bila nilai belum pernah disimpan
   * (enum unset). Baris menampilkan "Mengikuti default: X" supaya pengguna
   * tahu nilai efektifnya, bukan sekadar "—".
   */
  defaultValue?: T
}

/** Baris pemilih nilai enum (G077/G078/G079) — sheet opsi, bukan toggle. */
function EnumRow<T extends string>({ title, description, value, options, labels, pending, onPick, defaultValue }: EnumRowProps<T>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="min-h-14 flex-row items-center gap-3 px-5 py-3 active:opacity-70"
      >
        <View className="flex-1">
          <Text variant="body" weight={500}>{title}</Text>
          <Text variant="caption" tone="secondary">{description}</Text>
        </View>
        <Text variant="body" tone="secondary">
          {value
            ? (labels[value] ?? value)
            : defaultValue
              ? `Mengikuti default: ${labels[defaultValue] ?? defaultValue}`
              : "—"}
        </Text>
        <Icon icon={CaretRight} size="sm" tone="default" />
      </Pressable>
      <ActionSheet
        title={title}
        visible={open}
        onRequestClose={() => setOpen(false)}
        showCancel
        cancelLabel="Batal"
        actions={options.map((opt) => ({
          key: opt,
          label: `${labels[opt] ?? opt}${value === opt ? " ✓" : ""}`,
          onPress: () => {
            setOpen(false)
            if (opt !== value) onPick(opt)
          },
        }))}
      />
      {pending ? <Text variant="caption" tone="secondary">Menyimpan…</Text> : null}
    </>
  )
}

export default function PrivacySettingsScreen() {
  // Langganan bahasa: a11y label switch persetujuan (prop string, UI-M003).
  useLanguage()
  const toast = useToast()
  // Partial: server boleh mengirim subset; UI tidak boleh mengarang default.
  const query = useApiQuery<Partial<PrivacySettings>>("privacy-settings", (signal) =>
    api.settings.getPrivacySettings(signal).then((res) => res ?? {}),
  )
  const value: Partial<PrivacySettings> = query.data ?? {}
  const { setData } = query

  const [pending, setPending] = useState<string[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  /** Simpan satu field (boolean / enum / array) dengan optimistic update + rollback. */
  const saveField = useCallback(
    async (key: string, next: unknown) => {
      const previous = (value as Record<string, unknown>)[key]
      setData((prev) => ({ ...(prev ?? {}), [key]: next }))
      setPending((p) => [...p, key])
      try {
        await api.settings.updatePrivacySettings({ [key]: next } as unknown as UpdatePrivacyDto)
        toast.show({ title: "Pengaturan tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        // Rollback ke nilai server terakhir yang diketahui.
        setData((prev) => ({ ...(prev ?? {}), [key]: previous }))
        toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
      } finally {
        setPending((p) => p.filter((k) => k !== key))
      }
    },
    [value, setData, toast.show],
  )

  const handleChange = useCallback(
    async (key: string, next: boolean, all: Partial<Record<string, boolean>>) => {
      // `all` dari PrivacyToggleList bisa membawa beberapa key sekaligus;
      // kirim semuanya agar state server selaras dengan optimistic update.
      const keys = Object.keys(all)
      const payload = { ...all, [key]: next } as UpdatePrivacyDto
      const previous: Record<string, boolean | undefined> = {}
      for (const k of [...keys, key]) previous[k] = (value as Record<string, boolean | undefined>)[k]
      setData((prev) => ({ ...(prev ?? {}), ...all, [key]: next }))
      setPending((p) => [...p, ...keys, key])
      try {
        await api.settings.updatePrivacySettings(payload)
        toast.show({ title: "Pengaturan tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        setData((prev) => ({ ...(prev ?? {}), ...previous }))
        toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
      } finally {
        setPending((p) => p.filter((k) => k !== key && !keys.includes(k)))
      }
    },
    [value, setData, toast.show],
  )

  /** G082: toggle satu kunci statistik di dalam array hiddenStats. */
  const toggleHiddenStat = useCallback(
    (statKey: string, hide: boolean) => {
      const current = Array.isArray(value.hiddenStats) ? value.hiddenStats : []
      const next = hide
        ? Array.from(new Set([...current, statKey]))
        : current.filter((k) => k !== statKey)
      void saveField("hiddenStats", next)
    },
    [value.hiddenStats, saveField],
  )

  /** Buka URL unduh ekspor — D-10 (audit): WAJIB https, selain itu ditolak. */
  const openExportUrl = useCallback(
    async (rawUrl: string | undefined) => {
      const target = safeHttpsUrl(rawUrl)
      if (!target) {
        toast.show({
          title: "Ekspor data gagal dibuka",
          description:
            "Tautan ekspor bukan HTTPS dan ditolak demi keamanan data Anda. Coba lagi atau hubungi dukungan.",
          tone: "danger",
          duration: 6000,
        })
        return
      }
      const ok = await Linking.canOpenURL(target)
      if (ok) await Linking.openURL(target)
    },
    [toast],
  )

  // ── GAP-B1 (G084–G086): persetujuan ──────────────────────────────────
  const consents = useApiQuery<ConsentStatus[]>("consents", (signal) =>
    api.settings.getConsents(signal).catch(() => []),
  )
  const consentHistory = useApiQuery<ConsentHistoryEntry[]>(
    "consent-history",
    (signal) => api.settings.getConsentHistory(signal).catch(() => []),
  )
  const [consentPending, setConsentPending] = useState<ConsentType[]>([])
  // FE-IMP-3 #101 — riwayat persetujuan expandable.
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const CONSENT_LABELS: Record<ConsentType, { title: string; description: string }> = {
    MARKETING_PUSH: {
      title: "Notifikasi promosi",
      description: "Penawaran dan promo via push notification.",
    },
    MARKETING_EMAIL: {
      title: "Email promosi",
      description: "Penawaran dan promo via email.",
    },
    MARKETING_WHATSAPP: {
      title: "WhatsApp promosi",
      description: "Penawaran dan promo via WhatsApp.",
    },
    TRANSACTIONAL: {
      title: "Notifikasi transaksi",
      description: "Wajib untuk keamanan akun — tidak dapat dimatikan.",
    },
  }

  const handleConsentChange = useCallback(
    async (type: ConsentType, granted: boolean) => {
      if (consentPending.includes(type)) return
      const prev = consents.data?.find((c) => c.type === type)?.granted
      setConsentPending((p) => [...p, type])
      consents.setData((rows) =>
        (rows ?? []).map((c) => (c.type === type ? { ...c, granted } : c)),
      )
      try {
        await api.settings.updateConsent(type, granted)
        void consentHistory.reload()
        toast.show({ title: granted ? "Persetujuan diberikan" : "Persetujuan ditarik", tone: "success", duration: 2500 })
      } catch (err) {
        consents.setData((rows) =>
          (rows ?? []).map((c) => (c.type === type ? { ...c, granted: prev ?? c.granted } : c)),
        )
        toast.show({ title: "Gagal menyimpan persetujuan", description: userMessage(err), tone: "danger" })
      } finally {
        setConsentPending((p) => p.filter((t) => t !== type))
      }
    },
    [consentPending, consents, consentHistory, toast],
  )

  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json")

  const exportHistory = useApiQuery<ExportRequestSummary[]>("export-history", (signal) =>
    api.settings.getExportHistory(signal).catch(() => []),
  )

  // FE-IMP-3 #102 — permintaan terakhir (untuk "Terakhir diminta: {tanggal}"
  // di dialog konfirmasi ekspor). Ambil requestedAt termuda; riwayat tidak
  // dijamin terurut dari server.
  const lastExportAt = (exportHistory.data ?? []).reduce<string | null>(
    (acc, item) =>
      !acc || item.requestedAt > acc ? item.requestedAt : acc,
    null,
  )

  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Kontrak baru: arsip dibuat sinkron; respons membawa downloadUrl
      // bertanda waktu. Cooldown 24 jam → 400 dengan pesan yang jelas.
      const res = await api.settings.exportPrivacy(exportFormat)
      setExportOpen(false)
      void exportHistory.reload()
      toast.show({
        title: "Ekspor data siap",
        description: res.message || "Arsip data Anda siap diunduh. Tautan berlaku terbatas.",
        tone: "success",
        duration: 5000,
      })
      await openExportUrl(res.downloadUrl)
    } catch (err) {
      toast.show({ title: "Gagal meminta ekspor", description: userMessage(err), tone: "danger" })
    } finally {
      setExporting(false)
    }
  }, [exporting, exportFormat, toast, openExportUrl, exportHistory])

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const handleDownloadHistory = useCallback(
    async (request: ExportRequestSummary) => {
      if (downloadingId || request.status !== "READY") return
      setDownloadingId(request.id)
      try {
        // G100: setiap unduhan menerbitkan URL signed BARU (5 menit) dan
        // tercatat di audit log server — URL tidak pernah disimpan mentah.
        const res = await api.settings.downloadExportRequest(request.id)
        void exportHistory.reload()
        await openExportUrl(res.downloadUrl)
      } catch (err) {
        toast.show({ title: "Gagal mengunduh", description: userMessage(err), tone: "danger" })
      } finally {
        setDownloadingId(null)
      }
    },
    [downloadingId, toast, openExportUrl, exportHistory],
  )

  const hiddenStats = Array.isArray(value.hiddenStats) ? value.hiddenStats : []

  /** PrivacyToggleList hanya menerima boolean — petik subset yang relevan. */
  const boolValue = (...keys: string[]): Partial<Record<string, boolean>> => {
    const out: Partial<Record<string, boolean>> = {}
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k]
      if (typeof v === "boolean") out[k] = v
    }
    return out
  }

  return (
    <>
      <DataScreen title="Privasi" state={query} loadingMessage="Memuat pengaturan privasi…">
        <SectionHeader title="Visibilitas profil" />
        <Text variant="body" tone="secondary">
          Atur siapa yang dapat melihat informasi profil Anda.
        </Text>
        <PrivacyToggleList
          items={ITEMS}
          value={boolValue("profileVisible", "showOnlineStatus")}
          onChange={(k, n, all) => void handleChange(k, n, all)}
          pendingKeys={pending}
        />

        <SectionHeader title="Informasi identitas" />
        <Text variant="body" tone="secondary">
          Data akun yang boleh dilihat pengunjung profil Anda. Default: disembunyikan.
        </Text>
        <PrivacyToggleList
          items={IDENTITY_ITEMS}
          value={boolValue("showEmail", "showPhone", "showDob", "showGender")}
          onChange={(k, n, all) => void handleChange(k, n, all)}
          pendingKeys={pending}
        />

        <SectionHeader title="Daftar pengikut" />
        <Text variant="body" tone="secondary">
          Siapa yang dapat melihat daftar pengikut dan yang Anda ikuti.
        </Text>
        <EnumRow<PrivacyListVisibility>
          title="Daftar pengikut"
          description="Siapa yang dapat melihat siapa mengikuti Anda."
          value={value.showFollowerList}
          options={["EVERYONE", "FOLLOWERS", "ONLY_ME"]}
          labels={LIST_VISIBILITY_LABELS}
          pending={pending.includes("showFollowerList")}
          onPick={(next) => void saveField("showFollowerList", next)}
          // FE-IMP-3 #100 — default backend: DEFAULT_PRIVACY_SETTING di
          // backend/src/modules/users/privacy-profile.util.ts.
          defaultValue="EVERYONE"
        />
        <EnumRow<PrivacyListVisibility>
          title="Daftar mengikuti"
          description="Siapa yang dapat melihat siapa Anda ikuti."
          value={value.showFollowingList}
          options={["EVERYONE", "FOLLOWERS", "ONLY_ME"]}
          labels={LIST_VISIBILITY_LABELS}
          pending={pending.includes("showFollowingList")}
          onPick={(next) => void saveField("showFollowingList", next)}
          defaultValue="EVERYONE"
        />
        <EnumRow<string>
          title="Visibilitas default etalase"
          description="Visibilitas karya etalase baru yang Anda buat."
          value={value.showcaseDefaultVisibility}
          options={["PUBLIC", "FOLLOWERS", "PRIVATE"]}
          labels={SHOWCASE_VISIBILITY_LABELS}
          pending={pending.includes("showcaseDefaultVisibility")}
          onPick={(next) => void saveField("showcaseDefaultVisibility", next)}
          defaultValue="PUBLIC"
        />

        <SectionHeader title="Ulasan & statistik" />
        <PrivacyToggleList
          items={REVIEW_ITEMS}
          value={boolValue("showReviews")}
          onChange={(k, n, all) => void handleChange(k, n, all)}
          pendingKeys={pending}
        />
        <Text variant="body" tone="secondary">
          Statistik yang disembunyikan dari pengunjung profil:
        </Text>
        {HIDDEN_STAT_ITEMS.map((item) => {
          const hidden = hiddenStats.includes(item.key)
          return (
            <PrivacyToggleList
              key={item.key}
              items={[{ ...item, key: item.key }]}
              value={{ [item.key]: hidden }}
              onChange={() => toggleHiddenStat(item.key, !hidden)}
              pendingKeys={pending.includes("hiddenStats") ? [item.key] : []}
            />
          )
        })}

        <SectionHeader title="Interaksi & lainnya" />
        <EnumRow<QaCommentPolicy>
          title="Komentar Q&A profil"
          description="Siapa yang dapat bertanya/berkomentar di Q&A profil Anda."
          value={value.qaCommentPolicy}
          options={["EVERYONE", "FOLLOWERS", "DISABLED"]}
          labels={QA_POLICY_LABELS}
          pending={pending.includes("qaCommentPolicy")}
          onPick={(next) => void saveField("qaCommentPolicy", next)}
          defaultValue="EVERYONE"
        />
        <PrivacyToggleList
          items={MISC_ITEMS}
          value={boolValue("qaAnswerModeration", "searchEngineIndex")}
          onChange={(k, n, all) => void handleChange(k, n, all)}
          pendingKeys={pending}
        />

        <SectionHeader title="Persetujuan" />
        <Text variant="body" tone="secondary">
          Kelola persetujuan komunikasi. Persetujuan pemasaran dapat ditarik
          kapan saja; notifikasi transaksi wajib demi keamanan akun.
        </Text>
        {(consents.data ?? []).map((c) => {
          const meta = CONSENT_LABELS[c.type]
          const busy = consentPending.includes(c.type)
          return (
            <View key={c.type} className="flex-row items-center gap-3 px-5 py-3 opacity-100">
              <View className="flex-1">
                <Text variant="body" weight={500}>{meta.title}</Text>
                <Text variant="caption" tone="secondary">{meta.description}</Text>
                {c.grantedAt ? (
                  <Text variant="caption" tone="secondary">
                    {c.granted ? "Disetujui" : "Ditarik"} · v{c.policyVersion}
                  </Text>
                ) : null}
              </View>
              {/* UI-M003: pakai shared <Switch> — warna token, target sentuh
                  44pt, role switch, reduced-motion. Jangan kembalikan ke
                  Pressable hand-rolled. */}
              <Switch
                value={c.granted}
                onChange={(next) => void handleConsentChange(c.type, next)}
                disabled={!c.revocable || busy}
                accessibilityLabel={translate(meta.title)}
                className="self-center"
              />
            </View>
          )
        })}
        {(consentHistory.data ?? []).length > 0 ? (
          <>
            <Text variant="body" tone="secondary">
              Riwayat persetujuan:
            </Text>
            {(historyExpanded ? consentHistory.data ?? [] : (consentHistory.data ?? []).slice(0, 3)).map((h, i) => (
              <View key={`${h.type}-${h.createdAt}-${i}`} className="px-5 py-2">
                <Text variant="caption" tone="secondary">
                  {CONSENT_LABELS[h.type]?.title ?? h.type} — {h.granted ? "disetujui" : "ditarik"} · v{h.policyVersion} ·{" "}
                  {new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </View>
            ))}
            {/* FE-IMP-3 #101 — riwayat expandable "Lihat semua riwayat". */}
            {(consentHistory.data ?? []).length > 3 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setHistoryExpanded((v) => !v)}
                className="flex-row items-center gap-1 px-5 py-2 active:opacity-70"
              >
                <Text variant="body" tone="primary">
                  {historyExpanded
                    ? "Sembunyikan riwayat"
                    : `Lihat semua riwayat (${(consentHistory.data ?? []).length})`}
                </Text>
                <Icon
                  icon={CaretRight}
                  size="sm"
                  tone="default"
                  style={{ transform: [{ rotate: historyExpanded ? "90deg" : "-90deg" }] }}
                />
              </Pressable>
            ) : null}
          </>
        ) : null}

        <SectionHeader title="Data pribadi" />
        <Text variant="body" tone="secondary">
          Anda berhak meminta salinan seluruh data pribadi yang kami simpan.
          Arsip mencakup profil, pesanan, wallet, metadata chat (tanpa isi pesan),
          sengketa, ulasan, dan aktivitas — dengan data sensitif (KYC/bank)
          disamarkan. Setiap unduhan tercatat dan tautannya kedaluwarsa.
        </Text>
        <Button variant="secondary" leftIcon={DownloadSimple} onPress={() => setExportOpen(true)}>
          Minta salinan data saya
        </Button>

        {exportHistory.data && exportHistory.data.length > 0 ? (
          <>
            <SectionHeader title="Riwayat ekspor" />
            {exportHistory.data.map((item) => {
              const expired = item.status === "EXPIRED"
              const ready = item.status === "READY"
              return (
                <View key={item.id} className="flex-row items-center gap-3 px-5 py-3">
                  <View className="flex-1">
                    <Text variant="body" weight={500}>
                      {item.format === "CSV" ? "Arsip CSV (ZIP)" : "Arsip JSON"}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {new Date(item.requestedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {expired
                        ? " · Kedaluwarsa"
                        : ready && item.expiresAt
                          ? ` · Berlaku hingga ${new Date(item.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`
                          : ""}
                      {item.downloadCount > 0 ? ` · Diunduh ${item.downloadCount}×` : ""}
                    </Text>
                  </View>
                  {ready ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={downloadingId === item.id}
                      onPress={() => void handleDownloadHistory(item)}
                    >
                      Unduh
                    </Button>
                  ) : null}
                </View>
              )
            })}
          </>
        ) : null}
      </DataScreen>

      <Dialog
        title="Minta salinan data?"
        description="Arsip dibuat langsung dan tautan unduhnya berlaku terbatas. Maksimal 1 permintaan per 24 jam."
        visible={exportOpen}
        loading={exporting}
        confirmLabel="Minta ekspor"
        cancelLabel="Batal"
        onConfirm={() => void handleExport()}
        onCancel={() => setExportOpen(false)}
        onRequestClose={() => setExportOpen(false)}
      >
        {/* FE-IMP-3 #102 — tanggal permintaan terakhir SEBELUM konfirmasi. */}
        <Text variant="caption" tone="secondary" className="pt-1">
          Terakhir diminta:{" "}
          {lastExportAt
            ? new Date(lastExportAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "belum pernah"}
        </Text>
        <View className="flex-row gap-2 pt-2">
          {(["json", "csv"] as const).map((fmt) => (
            <Pressable
              key={fmt}
              accessibilityRole="button"
              onPress={() => setExportFormat(fmt)}
              className={`flex-1 rounded-xl border px-4 py-3 ${exportFormat === fmt ? "border-emerald-500" : "border-neutral-700"}`}
            >
              <Text variant="body" weight={500} className="text-center">
                {fmt === "json" ? "JSON" : "CSV (ZIP)"}
              </Text>
            </Pressable>
          ))}
        </View>
      </Dialog>
    </>
  )
}
