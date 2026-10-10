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
 *
 * Audit profil 2026-10-10:
 *   - E-14: semua teks lewat `translate()`. Daftar item/label TIDAK lagi
 *     konstanta modul — `translate()` di scope modul membekukan bahasa saat
 *     berkas pertama dimuat (pola `defaultLabels()` di
 *     components/ui/username-field.tsx). Builder dipanggil saat render;
 *     `useLanguage()` di komponen memastikan render ulang saat bahasa ganti.
 *   - E-19: menggeser satu switch hanya mengirim `{ [key]: next }` dan hanya
 *     key itu yang `pending` — bukan seluruh grup (dulu semua switch grup
 *     berputar dan rollback menimpa seluruh grup).
 *   - E-28: `Linking.canOpenURL` false → toast danger + aksi "Salin tautan",
 *     supaya pengguna tetap bisa mengunduh ekspor lewat browser.
 */
import { useCallback, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { CaretRight, DownloadSimple } from "phosphor-react-native"

import { api } from "@/lib/api"
import { copyToClipboard } from "@/lib/clipboard"
import { formatDate } from "@/lib/format"
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
import { showMutationError } from "@/lib/mutation-toast"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Icon } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { PrivacyToggleList, type PrivacyToggleItem } from "@/components/ui/privacy-toggle-list"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

/** E-22: enum backend ShowcaseVisibility hanya PUBLIC|PRIVATE. */
type ShowcaseDefaultVisibility = NonNullable<PrivacySettings["showcaseDefaultVisibility"]>

type ToggleItems = {
  profile: readonly PrivacyToggleItem[]
  identity: readonly PrivacyToggleItem[]
  review: readonly PrivacyToggleItem[]
  hiddenStat: readonly PrivacyToggleItem[]
  misc: readonly PrivacyToggleItem[]
}

/**
 * E-14: daftar toggle dibangun saat render (bukan konstanta modul) — lihat
 * header berkas. Kunci = teks Indonesia (konvensi lib/i18n).
 */
function buildToggleItems(): ToggleItems {
  return {
    profile: [
      {
        key: "profileVisible",
        title: translate("Profil terlihat publik"),
        description: translate("Pengguna lain bisa melihat profil Anda."),
      },
      {
        key: "showOnlineStatus",
        title: translate("Tampilkan status online"),
        description: translate("Menampilkan indikator online pada profil Anda."),
      },
    ],
    /** G076: visibilitas field identitas akun (berlaku untuk pengunjung profil). */
    identity: [
      {
        key: "showEmail",
        title: translate("Tampilkan email akun"),
        description: translate("Pengunjung profil bisa melihat alamat email Anda."),
      },
      {
        key: "showPhone",
        title: translate("Tampilkan nomor HP"),
        description: translate("Pengunjung profil bisa melihat nomor HP Anda."),
      },
      {
        key: "showDob",
        title: translate("Tampilkan tanggal lahir"),
        description: translate("Pengunjung profil bisa melihat tanggal lahir Anda."),
      },
      {
        key: "showGender",
        title: translate("Tampilkan gender"),
        description: translate("Pengunjung profil bisa melihat gender Anda."),
      },
    ],
    /** G081: ulasan publik. */
    review: [
      {
        key: "showReviews",
        title: translate("Tampilkan ulasan"),
        description: translate("Ulasan dan rating Anda terlihat di profil publik."),
      },
    ],
    /** G082: kunci statistik yang bisa disembunyikan (mirror backend KNOWN_HIDDEN_STAT_KEYS). */
    hiddenStat: [
      {
        key: "totalOrders",
        title: translate("Jumlah transaksi"),
        description: translate("Sembunyikan total transaksi selesai."),
      },
      {
        key: "avgRating",
        title: translate("Rata-rata rating"),
        description: translate("Sembunyikan rata-rata rating."),
      },
      {
        key: "ratingCount",
        title: translate("Jumlah rating"),
        description: translate("Sembunyikan jumlah rating."),
      },
      {
        key: "memberSince",
        title: translate("Tanggal bergabung"),
        description: translate("Sembunyikan tanggal bergabung."),
      },
    ],
    /** G083 + G080: toggle lain. */
    misc: [
      {
        key: "qaAnswerModeration",
        title: translate("Moderasi jawaban Q&A"),
        description: translate("Jawaban Q&A baru tidak publik sampai Anda terbitkan."),
      },
      {
        key: "searchEngineIndex",
        title: translate("Izinkan mesin pencari"),
        // FE-IMP-3 #104 — jujur soal propagasi: perubahan butuh beberapa hari
        // untuk tercermin di hasil pencarian (cache perayap, bukan instan).
        description: translate(
          "Profil Anda boleh diindeks mesin pencari. Perubahan membutuhkan beberapa hari untuk berlaku di hasil pencarian.",
        ),
      },
    ],
  }
}

type EnumLabels = {
  list: Record<PrivacyListVisibility, string>
  qa: Record<QaCommentPolicy, string>
  showcase: Record<ShowcaseDefaultVisibility, string>
}

/** E-14: label enum dibangun saat render — lihat header berkas. */
function buildEnumLabels(): EnumLabels {
  return {
    list: {
      EVERYONE: translate("Semua orang"),
      FOLLOWERS: translate("Pengikut saja"),
      ONLY_ME: translate("Hanya saya"),
    },
    qa: {
      EVERYONE: translate("Semua orang"),
      FOLLOWERS: translate("Pengikut saja"),
      DISABLED: translate("Nonaktif"),
    },
    showcase: {
      PUBLIC: translate("Publik"),
      PRIVATE: translate("Pribadi"),
    },
  }
}

type ConsentLabels = Record<ConsentType, { title: string; description: string }>

/** E-14: label persetujuan (G084–G086) dibangun saat render — lihat header berkas. */
function buildConsentLabels(): ConsentLabels {
  return {
    MARKETING_PUSH: {
      title: translate("Notifikasi promosi"),
      description: translate("Penawaran dan promo via push notification."),
    },
    MARKETING_EMAIL: {
      title: translate("Email promosi"),
      description: translate("Penawaran dan promo via email."),
    },
    MARKETING_WHATSAPP: {
      title: translate("WhatsApp promosi"),
      description: translate("Penawaran dan promo via WhatsApp."),
    },
    TRANSACTIONAL: {
      title: translate("Notifikasi transaksi"),
      description: translate("Wajib untuk keamanan akun — tidak dapat dimatikan."),
    },
  }
}

type EnumRowProps<T extends string> = {
  /** Sudah diterjemahkan oleh pemanggil. */
  title: string
  /** Sudah diterjemahkan oleh pemanggil. */
  description: string
  value: T | undefined
  options: readonly T[]
  /** Sudah diterjemahkan oleh pemanggil. */
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
  // Langganan bahasa: teks internal ("Mengikuti default", "Batal", "Menyimpan…").
  useLanguage()
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
              ? translate("Mengikuti default: {x}", { x: labels[defaultValue] ?? defaultValue })
              : "—"}
        </Text>
        <Icon icon={CaretRight} size="sm" tone="default" />
      </Pressable>
      <ActionSheet
        title={title}
        visible={open}
        onRequestClose={() => setOpen(false)}
        showCancel
        cancelLabel={translate("Batal")}
        actions={options.map((opt) => ({
          key: opt,
          label: `${labels[opt] ?? opt}${value === opt ? " ✓" : ""}`,
          onPress: () => {
            setOpen(false)
            if (opt !== value) onPick(opt)
          },
        }))}
      />
      {pending ? <Text variant="caption" tone="secondary">{translate("Menyimpan…")}</Text> : null}
    </>
  )
}

export default function PrivacySettingsScreen() {
  // Langganan bahasa: builder label di bawah memanggil translate() saat render
  // (E-14) dan a11y label switch persetujuan adalah prop string (UI-M003).
  useLanguage()
  const toast = useToast()
  // Partial: server boleh mengirim subset; UI tidak boleh mengarang default.
  const query = useApiQuery<Partial<PrivacySettings>>("privacy-settings", (signal) =>
    api.settings.getPrivacySettings(signal).then((res) => res ?? {}),
  )
  const value: Partial<PrivacySettings> = query.data ?? {}
  const { setData } = query

  const items = buildToggleItems()
  const enumLabels = buildEnumLabels()
  const consentLabels = buildConsentLabels()

  const [pending, setPending] = useState<string[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  /**
   * Simpan satu field (boolean / enum / array) dengan optimistic update + rollback.
   * E-19: juga dipakai untuk toggle grup — hanya `key` yang dikirim & pending.
   */
  const saveField = useCallback(
    async (key: string, next: unknown) => {
      const previous = (value as Record<string, unknown>)[key]
      setData((prev) => ({ ...(prev ?? {}), [key]: next }))
      setPending((p) => [...p, key])
      try {
        await api.settings.updatePrivacySettings({ [key]: next } as unknown as UpdatePrivacyDto)
        toast.show({ title: translate("Pengaturan tersimpan"), tone: "success", duration: 2500 })
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal menyimpan"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "privacy-settings:menyimpan",
          })
        ) {
          void query.reload()
        } else {
          // Rollback ke nilai server terakhir yang diketahui.
          setData((prev) => ({ ...(prev ?? {}), [key]: previous }))
        }
      } finally {
        setPending((p) => p.filter((k) => k !== key))
      }
    },
    [value, setData, toast.show, query],
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
          title: translate("Ekspor data gagal dibuka"),
          description: translate(
            "Tautan ekspor bukan HTTPS dan ditolak demi keamanan data Anda. Coba lagi atau hubungi dukungan.",
          ),
          tone: "danger",
          duration: 6000,
        })
        return
      }
      const ok = await Linking.canOpenURL(target)
      if (ok) {
        await Linking.openURL(target)
        return
      }
      // E-28: tidak ada handler untuk tautan → jangan diam. Tawarkan salin
      // tautan supaya arsip tetap bisa diunduh lewat browser lain.
      toast.show({
        title: translate("Tautan ekspor tidak bisa dibuka"),
        description: translate(
          "Tidak ada aplikasi yang bisa membuka tautan ini. Salin tautan lalu buka di browser.",
        ),
        tone: "danger",
        duration: 8000,
        action: {
          label: translate("Salin tautan"),
          onPress: () => {
            void copyToClipboard(target).then((copied) => {
              toast.show({
                title: translate(copied ? "Tautan disalin" : "Gagal menyalin tautan"),
                tone: copied ? "success" : "danger",
                duration: 2500,
              })
            })
          },
        },
      })
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
        toast.show({
          title: translate(granted ? "Persetujuan diberikan" : "Persetujuan ditarik"),
          tone: "success",
          duration: 2500,
        })
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal menyimpan persetujuan"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "privacy-settings:menyimpan-persetujuan",
          })
        ) {
          void consents.reload()
        } else {
          consents.setData((rows) =>
          (rows ?? []).map((c) => (c.type === type ? { ...c, granted: prev ?? c.granted } : c)),
          )
        }
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
        title: translate("Ekspor data siap"),
        description: res.message || translate("Arsip data Anda siap diunduh. Tautan berlaku terbatas."),
        tone: "success",
        duration: 5000,
      })
      await openExportUrl(res.downloadUrl)
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal meminta ekspor"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "privacy-settings:meminta-ekspor",
        })
      ) {
        void exportHistory.reload()
      }
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
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal mengunduh"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "privacy-settings:mengunduh",
          })
        ) {
          void exportHistory.reload()
        }
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

  // E-19: abaikan argumen `all` dari PrivacyToggleList — hanya key yang
  // digeser yang dikirim/pending (lihat saveField).
  const onToggle = (key: string, next: boolean) => void saveField(key, next)

  return (
    <>
      <DataScreen
        title={translate("Privasi")}
        state={query}
        loadingMessage={translate("Memuat pengaturan privasi…")}
      >
        <SectionHeader title={translate("Visibilitas profil")} />
        <Text variant="body" tone="secondary">
          {translate("Atur siapa yang dapat melihat informasi profil Anda.")}
        </Text>
        <PrivacyToggleList
          items={items.profile}
          value={boolValue("profileVisible", "showOnlineStatus")}
          onChange={onToggle}
          pendingKeys={pending}
        />

        <SectionHeader title={translate("Informasi identitas")} />
        <Text variant="body" tone="secondary">
          {translate("Data akun yang boleh dilihat pengunjung profil Anda. Default: disembunyikan.")}
        </Text>
        <PrivacyToggleList
          items={items.identity}
          value={boolValue("showEmail", "showPhone", "showDob", "showGender")}
          onChange={onToggle}
          pendingKeys={pending}
        />

        <SectionHeader title={translate("Daftar pengikut")} />
        <Text variant="body" tone="secondary">
          {translate("Siapa yang dapat melihat daftar pengikut dan yang Anda ikuti.")}
        </Text>
        <EnumRow<PrivacyListVisibility>
          title={translate("Daftar pengikut")}
          description={translate("Siapa yang dapat melihat siapa mengikuti Anda.")}
          value={value.showFollowerList}
          options={["EVERYONE", "FOLLOWERS", "ONLY_ME"]}
          labels={enumLabels.list}
          pending={pending.includes("showFollowerList")}
          onPick={(next) => void saveField("showFollowerList", next)}
          // FE-IMP-3 #100 — default backend: DEFAULT_PRIVACY_SETTING di
          // backend/src/modules/users/privacy-profile.util.ts.
          defaultValue="EVERYONE"
        />
        <EnumRow<PrivacyListVisibility>
          title={translate("Daftar mengikuti")}
          description={translate("Siapa yang dapat melihat siapa Anda ikuti.")}
          value={value.showFollowingList}
          options={["EVERYONE", "FOLLOWERS", "ONLY_ME"]}
          labels={enumLabels.list}
          pending={pending.includes("showFollowingList")}
          onPick={(next) => void saveField("showFollowingList", next)}
          defaultValue="EVERYONE"
        />
        <EnumRow<ShowcaseDefaultVisibility>
          title={translate("Visibilitas default etalase")}
          description={translate("Visibilitas etalase baru yang Anda buat.")}
          // E-22: tipe sudah PUBLIC|PRIVATE (selaras enum backend
          // ShowcaseVisibility) — tidak perlu pemetaan manual lagi.
          value={value.showcaseDefaultVisibility}
          options={["PUBLIC", "PRIVATE"]}
          labels={enumLabels.showcase}
          pending={pending.includes("showcaseDefaultVisibility")}
          onPick={(next) => void saveField("showcaseDefaultVisibility", next)}
          defaultValue="PUBLIC"
        />

        <SectionHeader title={translate("Ulasan & statistik")} />
        <PrivacyToggleList
          items={items.review}
          value={boolValue("showReviews")}
          onChange={onToggle}
          pendingKeys={pending}
        />
        <Text variant="body" tone="secondary">
          {translate("Statistik yang disembunyikan dari pengunjung profil:")}
        </Text>
        {items.hiddenStat.map((item) => {
          const hidden = hiddenStats.includes(item.key)
          return (
            <PrivacyToggleList
              key={item.key}
              items={[item]}
              value={{ [item.key]: hidden }}
              onChange={() => toggleHiddenStat(item.key, !hidden)}
              pendingKeys={pending.includes("hiddenStats") ? [item.key] : []}
            />
          )
        })}

        <SectionHeader title={translate("Interaksi & lainnya")} />
        <EnumRow<QaCommentPolicy>
          title={translate("Komentar Q&A profil")}
          description={translate("Siapa yang dapat bertanya/berkomentar di Q&A profil Anda.")}
          value={value.qaCommentPolicy}
          options={["EVERYONE", "FOLLOWERS", "DISABLED"]}
          labels={enumLabels.qa}
          pending={pending.includes("qaCommentPolicy")}
          onPick={(next) => void saveField("qaCommentPolicy", next)}
          defaultValue="EVERYONE"
        />
        <PrivacyToggleList
          items={items.misc}
          value={boolValue("qaAnswerModeration", "searchEngineIndex")}
          onChange={onToggle}
          pendingKeys={pending}
        />

        <SectionHeader title={translate("Persetujuan")} />
        <Text variant="body" tone="secondary">
          {translate(
            "Kelola persetujuan komunikasi. Persetujuan pemasaran dapat ditarik kapan saja; notifikasi transaksi wajib demi keamanan akun.",
          )}
        </Text>
        {(consents.data ?? []).map((c) => {
          const meta = consentLabels[c.type]
          const busy = consentPending.includes(c.type)
          return (
            <View key={c.type} className="flex-row items-center gap-3 px-5 py-3 opacity-100">
              <View className="flex-1">
                <Text variant="body" weight={500}>{meta.title}</Text>
                <Text variant="caption" tone="secondary">{meta.description}</Text>
                {c.grantedAt ? (
                  <Text variant="caption" tone="secondary">
                    {translate(c.granted ? "Disetujui" : "Ditarik")} · v{c.policyVersion}
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
                accessibilityLabel={meta.title}
                className="self-center"
              />
            </View>
          )
        })}
        {(consentHistory.data ?? []).length > 0 ? (
          <>
            <Text variant="body" tone="secondary">
              {translate("Riwayat persetujuan:")}
            </Text>
            {(historyExpanded ? consentHistory.data ?? [] : (consentHistory.data ?? []).slice(0, 3)).map((h, i) => (
              <View key={`${h.type}-${h.createdAt}-${i}`} className="px-5 py-2">
                <Text variant="caption" tone="secondary">
                  {consentLabels[h.type]?.title ?? h.type} — {translate(h.granted ? "disetujui" : "ditarik")} · v
                  {h.policyVersion} · {formatDate(h.createdAt)}
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
                    ? translate("Sembunyikan riwayat")
                    : translate("Lihat semua riwayat ({x})", { x: (consentHistory.data ?? []).length })}
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

        <SectionHeader title={translate("Data pribadi")} />
        <Text variant="body" tone="secondary">
          {translate(
            "Anda berhak meminta salinan seluruh data pribadi yang kami simpan. Arsip mencakup profil, pesanan, wallet, metadata chat (tanpa isi pesan), sengketa, ulasan, dan aktivitas — dengan data sensitif (KYC/bank) disamarkan. Setiap unduhan tercatat dan tautannya kedaluwarsa.",
          )}
        </Text>
        <Button variant="secondary" leftIcon={DownloadSimple} onPress={() => setExportOpen(true)}>
          {translate("Minta salinan data saya")}
        </Button>

        {exportHistory.data && exportHistory.data.length > 0 ? (
          <>
            <SectionHeader title={translate("Riwayat ekspor")} />
            {exportHistory.data.map((item) => {
              const expired = item.status === "EXPIRED"
              const ready = item.status === "READY"
              return (
                <View key={item.id} className="flex-row items-center gap-3 px-5 py-3">
                  <View className="flex-1">
                    <Text variant="body" weight={500}>
                      {translate(item.format === "CSV" ? "Arsip CSV (ZIP)" : "Arsip JSON")}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {formatDate(item.requestedAt)}
                      {expired
                        ? ` · ${translate("Kedaluwarsa")}`
                        : ready && item.expiresAt
                          ? ` · ${translate("Berlaku hingga {x}", { x: formatDate(item.expiresAt) })}`
                          : ""}
                      {item.downloadCount > 0
                        ? ` · ${translate("Diunduh {x}×", { x: item.downloadCount })}`
                        : ""}
                    </Text>
                  </View>
                  {ready ? (
                    <Button
                      fullWidth={false}
                      variant="secondary"
                      size="sm"
                      loading={downloadingId === item.id}
                      onPress={() => void handleDownloadHistory(item)}
                    >
                      {translate("Unduh")}
                    </Button>
                  ) : null}
                </View>
              )
            })}
          </>
        ) : null}
      </DataScreen>

      <Dialog
        title={translate("Minta salinan data?")}
        description={translate(
          "Arsip dibuat langsung dan tautan unduhnya berlaku terbatas. Maksimal 1 permintaan per 24 jam.",
        )}
        visible={exportOpen}
        loading={exporting}
        confirmLabel={translate("Minta ekspor")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleExport()}
        onCancel={() => setExportOpen(false)}
        onRequestClose={() => setExportOpen(false)}
      >
        {/* FE-IMP-3 #102 — tanggal permintaan terakhir SEBELUM konfirmasi. */}
        <Text variant="caption" tone="secondary" className="pt-1">
          {translate("Terakhir diminta: {x}", {
            x: lastExportAt ? formatDate(lastExportAt) : translate("belum pernah"),
          })}
        </Text>
        <View className="flex-row gap-2 pt-2">
          {(["json", "csv"] as const).map((fmt) => (
            // UX-TCH-020: PressableScale (feedback scale saat ditekan);
            // sebelumnya Pressable polos tanpa feedback. `flex-1` ditaruh di
            // containerClassName supaya layout baris tetap terbagi rata.
            <PressableScale
              key={fmt}
              accessibilityRole="button"
              onPress={() => setExportFormat(fmt)}
              containerClassName="flex-1"
              className={`rounded-lg border px-4 py-3 ${exportFormat === fmt ? "border-emerald-500" : "border-neutral-700"}`}
            >
              <Text variant="body" weight={500} className="text-center">
                {/* Nama format berkas (bukan prosa) — sengaja tidak diterjemahkan. */}
                {fmt === "json" ? "JSON" : "CSV (ZIP)"}
              </Text>
            </PressableScale>
          ))}
        </View>
      </Dialog>
    </>
  )
}
