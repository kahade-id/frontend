/**
 * Kahade — file viewer halaman media terpusat (`type=file`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): teks putih di atas hitam solid kedua
 * mode untuk chrome viewer — preseden showcase-media-gallery.
 *
 * Strategi per tipe (TIDAK ADA yang dilempar ke browser luar):
 *   - PDF: render IN-APP via WebView — iOS memuat berkas lokal hasil unduhan
 *     (render native + scroll + pinch-zoom), Android memakai embed penampil
 *     dokumen Google IN-APP (WebView tetap di dalam aplikasi). Gagal → kartu.
 *   - TXT/MD/CSV/LOG/JSON: tampilan BACA in-app (teks + cari + navigasi hasil).
 *     JSON di-parse & dirapikan dulu — tidak pernah dump mentah.
 *   - DOCX/XLSX/PPT: embed penampil dokumen IN-APP; gagal → kartu berkas.
 *   - Lainnya: kartu berkas rapi (ikon, nama, ukuran) + Unduh + "Buka dengan
 *     aplikasi lain" (sheet OS, bukan browser).
 *
 * Keputusan non-obvious:
 *   - Cari teks didukung PENUH di penampil teks; di PDF/office TIDAK (keterbatasan
 *     embed viewer) — tombol cari hanya tampil di mode teks (jangan tombol mati).
 *   - Signed URL diteruskan verbatim (di-encode sebagai param embed viewer —
 *     signature tetap utuh). Embed hanya untuk https; file:// lokal → kartu.
 *   - WebView dibungkus error boundary: APK lama tanpa modul webview jatuh ke
 *     kartu berkas, bukan crash.
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Platform, ScrollView, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native"
import { ArrowClockwise, DownloadSimple, MagnifyingGlass, ShareNetwork, X } from "phosphor-react-native"
import { WebView } from "react-native-webview"

import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { Input } from "@/components/ui/input"
import { attachmentIcon } from "@/components/ui/chat-attachment-item"
import { useToast } from "@/components/ui/toast"
import { ViewerError, ViewerIconButton, ViewerLoading } from "@/components/media-viewer/viewer-chrome"
import { tokens } from "@/lib/tokens"
import { formatFileSize } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { isOfficeDocument, isPdfMedia, isReadableTextFile } from "@/lib/media-viewer"
import {
  MediaActionError,
  downloadToCache,
  ensureFileExtension,
  inferFileName,
  openFileWithOtherApp,
  shareRemoteFile,
} from "@/lib/media-actions"

export type FileViewerProps = {
  url: string
  title?: string | null
  mimeType?: string | null
  fileName?: string | null
  fileSize?: number | null
}

/** Maksimum teks yang dibaca untuk tampilan baca (500 KB). */
const TEXT_PREVIEW_MAX_BYTES = 500 * 1024
/** Maksimum hasil cari yang ditandai (hindari ribuan segmen). */
const SEARCH_MATCH_MAX = 500

type ViewMode = "loading" | "pdf" | "text" | "doc" | "card" | "error"

class WebViewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** URL embed penampil dokumen (signature signed URL dipertahankan via encode). */
function docEmbedUrl(remoteUrl: string): string {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(remoteUrl)}`
}

export function FileViewer({ url, title, mimeType, fileName, fileSize }: FileViewerProps) {
  const toast = useToast()
  const [mode, setMode] = useState<ViewMode>("loading")
  const [localUri, setLocalUri] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [textTruncated, setTextTruncated] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressLabel, setProgressLabel] = useState("Menyiapkan berkas…")
  const [busy, setBusy] = useState<"download" | "open" | "share" | null>(null)
  const [errorDetail, setErrorDetail] = useState("")
  const mountedRef = useRef(true)

  const displayName = useMemo(
    () => ensureFileExtension(inferFileName(url, fileName ?? title, "berkas"), mimeType),
    [url, fileName, title, mimeType],
  )
  const isRemoteHttps = /^https:/i.test(url)

  // ── Keputusan mode + persiapan (unduh bila perlu) ──────────────────
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    const finish = (patch: () => void) => {
      if (!cancelled && mountedRef.current) patch()
    }

    void (async () => {
      // 1. Teks → fetch + tampilkan sebagai bacaan.
      if (isReadableTextFile(mimeType, displayName)) {
        if (!isRemoteHttps && !url.startsWith("file:")) {
          finish(() => {
            setErrorDetail("Tautan berkas tidak valid.")
            setMode("error")
          })
          return
        }
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 30_000)
          const res = await fetch(url, { signal: controller.signal })
          clearTimeout(timer)
          if (!res.ok) throw new Error(`http-${res.status}`)
          const raw = await res.text()
          let body = raw.slice(0, TEXT_PREVIEW_MAX_BYTES)
          // JSON: rapikan (tampilan baca), bukan dump mentah satu baris.
          if (/\.json$/i.test(displayName) || (mimeType ?? "").includes("json")) {
            try {
              body = JSON.stringify(JSON.parse(body), null, 2).slice(0, TEXT_PREVIEW_MAX_BYTES)
            } catch {
              // Bukan JSON valid → tampilkan apa adanya sebagai teks.
            }
          }
          const truncated = raw.length > TEXT_PREVIEW_MAX_BYTES
          finish(() => {
            setText(body)
            setTextTruncated(truncated)
            setMode("text")
          })
        } catch {
          finish(() => {
            setErrorDetail(
              "Teks gagal dimuat. Periksa koneksi internet Anda — atau unduh berkasnya langsung dari kartu di bawah.",
            )
            setMode("card")
          })
        }
        return
      }

      // 2. PDF — iOS: unduh lalu render lokal (native); Android/web: embed in-app.
      if (isPdfMedia(mimeType, displayName)) {
        if (Platform.OS === "ios") {
          finish(() => setProgressLabel("Mengunduh PDF…"))
          try {
            const local = await downloadToCache(url, displayName, {
              onProgress: ({ written, total }) => {
                if (cancelled || !mountedRef.current) return
                setProgress(total > 0 ? Math.round((written / total) * 100) : null)
              },
            })
            finish(() => {
              setLocalUri(local)
              setMode("pdf")
            })
          } catch (err) {
            finish(() => {
              setErrorDetail(
                err instanceof MediaActionError
                  ? err.message
                  : "PDF gagal diunduh. Periksa koneksi lalu coba lagi.",
              )
              setMode("card")
            })
          }
          return
        }
        if (isRemoteHttps) {
          finish(() => setMode("pdf"))
          return
        }
        finish(() => setMode("card"))
        return
      }

      // 3. Dokumen office → embed in-app bila remote https; selain itu kartu.
      if (isOfficeDocument(mimeType, displayName) && isRemoteHttps) {
        finish(() => setMode("doc"))
        return
      }

      // 4. Sisanya → kartu berkas.
      finish(() => setMode("card"))
    })()

    return () => {
      cancelled = true
    }
  }, [url, mimeType, displayName, isRemoteHttps])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ── Aksi kartu ─────────────────────────────────────────────────────
  const runAction = useCallback(
    async (kind: "download" | "open" | "share") => {
      if (busy) return
      setBusy(kind)
      setProgress(null)
      setProgressLabel(
        kind === "download" ? "Mengunduh berkas…" : kind === "open" ? "Menyiapkan berkas…" : "Menyiapkan bagikan…",
      )
      const onProgress = ({ written, total }: { written: number; total: number }) =>
        setProgress(total > 0 ? Math.round((written / total) * 100) : null)
      try {
        if (kind === "download") {
          // Dokumen: unduh lalu sheet OS agar user memilih tujuan simpan
          // (Files/Drive) — tidak ada path misterius.
          await openFileWithOtherApp(url, displayName, mimeType, { onProgress })
          toast.show({ title: "Pilih tujuan simpan di sheet yang muncul", tone: "info" })
        } else if (kind === "open") {
          await openFileWithOtherApp(url, displayName, mimeType, { onProgress })
        } else {
          await shareRemoteFile(url, displayName, mimeType, { onProgress })
        }
      } catch (err) {
        toast.show({
          title: err instanceof MediaActionError ? err.message : "Gagal memproses berkas. Coba lagi.",
          tone: "danger",
        })
      } finally {
        if (mountedRef.current) {
          setBusy(null)
          setProgress(null)
        }
      }
    },
    [busy, url, displayName, mimeType, toast],
  )

  const headerActions = (
    <>
      <ViewerIconButton
        icon={ShareNetwork}
        label="Bagikan berkas"
        onPress={() => void runAction("share")}
        disabled={busy != null}
      />
      <ViewerIconButton
        icon={DownloadSimple}
        label="Unduh berkas"
        onPress={() => void runAction("download")}
        disabled={busy != null}
      />
    </>
  )

  if (mode === "loading") {
    return (
      <View className="flex-1 bg-black">
        {progress != null ? (
          <View className="flex-1 items-center justify-center gap-3 px-10">
            <Text variant="body" className="text-white">
              {progressLabel}
            </Text>
            <ProgressBar value={progress} showValue />
          </View>
        ) : (
          <ViewerLoading label="Menyiapkan pratinjau berkas…" />
        )}
      </View>
    )
  }

  if (mode === "error") {
    return (
      <View className="flex-1 bg-black">
        <ViewerError title="Berkas tidak bisa dibuka" description={errorDetail || "Tautan berkas tidak valid."} />
      </View>
    )
  }

  if (mode === "text" && text != null) {
    return (
      <TextFileView
        fileName={displayName}
        text={text}
        truncated={textTruncated}
        actions={headerActions}
      />
    )
  }

  if (mode === "pdf" || mode === "doc") {
    const sourceUri = mode === "pdf" && localUri ? localUri : docEmbedUrl(url)
    return (
      <View className="flex-1 bg-black">
        <WebViewBoundary
          fallback={
            <FileCard
              fileName={displayName}
              mimeType={mimeType}
              fileSize={fileSize}
              note="Pratinjau tidak tersedia di perangkat ini — unduh atau buka dengan aplikasi lain."
              busy={busy}
              progress={progress}
              progressLabel={progressLabel}
              onAction={(kind) => void runAction(kind)}
            />
          }
        >
          <WebView
            source={{ uri: sourceUri }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center gap-3 bg-black">
                <Spinner size="md" tone="inverse" />
                <Text variant="body" className="text-white">
                  Memuat pratinjau…
                </Text>
              </View>
            )}
            onError={() => {
              // Embed gagal (offline/URL privat) → jatuh ke kartu berkas.
              setErrorDetail(
                "Pratinjau gagal dimuat. Berkasnya tetap bisa diunduh atau dibuka dengan aplikasi lain.",
              )
              setMode("card")
            }}
            onHttpError={() => {
              setErrorDetail(
                "Pratinjau gagal dimuat. Berkasnya tetap bisa diunduh atau dibuka dengan aplikasi lain.",
              )
              setMode("card")
            }}
          />
        </WebViewBoundary>
        {/* Catatan zoom: cubit untuk memperbesar (native WebView). */}
        <View className="items-center bg-black px-4 py-2">
          <Text variant="caption" className="text-white opacity-70">
            Cubit untuk memperbesar · Geser untuk pindah halaman
          </Text>
        </View>
      </View>
    )
  }

  // mode === "card"
  return (
    <View className="flex-1 bg-black">
      <FileCard
        fileName={displayName}
        mimeType={mimeType}
        fileSize={fileSize}
        note={errorDetail || undefined}
        busy={busy}
        progress={progress}
        progressLabel={progressLabel}
        onAction={(kind) => void runAction(kind)}
        actions={headerActions}
      />
    </View>
  )
}

/** Kartu berkas rapi: ikon + nama + ukuran + aksi (tidak pernah JSON mentah). */
export function FileCard({
  fileName,
  mimeType,
  fileSize,
  note,
  busy,
  progress,
  progressLabel,
  onAction,
  actions,
}: {
  fileName: string
  mimeType?: string | null
  fileSize?: number | null
  note?: string
  busy: "download" | "open" | "share" | null
  progress: number | null
  progressLabel: string
  onAction: (kind: "download" | "open" | "share") => void
  actions?: ReactNode
}) {
  const IconComponent = attachmentIcon(mimeType ?? "")
  return (
    <View className="flex-1">
      {actions ? (
        <View className="flex-row items-center justify-end gap-2 px-4 py-2">{actions}</View>
      ) : null}
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-full max-w-[320px] items-center gap-3 rounded-md border border-border bg-surface-elevated p-6">
          <IconBox icon={IconComponent} size="lg" variant="surface" />
          <Text variant="body" weight={600} numberOfLines={3} ellipsizeMode="middle" className="text-center">
            {fileName}
          </Text>
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {[fileSize ? formatFileSize(fileSize) : null, shortMime(mimeType)].filter(Boolean).join(" · ") || "Berkas"}
          </Text>
          {note ? (
            <Text variant="caption" tone="secondary" className="text-center">
              {note}
            </Text>
          ) : null}
          {busy && progress != null ? (
            <View className="w-full gap-1">
              <ProgressBar value={progress} showValue label={progressLabel} />
            </View>
          ) : busy ? (
            <View className="flex-row items-center gap-2">
              <Spinner size="sm" />
              <Text variant="caption" tone="secondary">
                {progressLabel}
              </Text>
            </View>
          ) : null}
          <View className="w-full gap-2">
            <CardButton
              label="Unduh"
              icon={DownloadSimple}
              primary
              loading={busy === "download"}
              disabled={busy != null}
              onPress={() => onAction("download")}
            />
            <CardButton
              label="Buka dengan aplikasi lain"
              icon={ArrowClockwise}
              loading={busy === "open"}
              disabled={busy != null}
              onPress={() => onAction("open")}
            />
            <CardButton
              label="Bagikan"
              icon={ShareNetwork}
              loading={busy === "share"}
              disabled={busy != null}
              onPress={() => onAction("share")}
            />
          </View>
        </View>
      </View>
    </View>
  )
}

function CardButton({
  label,
  icon,
  primary = false,
  loading = false,
  disabled = false,
  onPress,
}: {
  label: string
  icon: typeof DownloadSimple
  primary?: boolean
  loading?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-2 rounded-sm px-4 py-2.5 ${
        primary ? "bg-primary" : "bg-surface"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {loading ? (
        <Spinner size="sm" tone={primary ? "inverse" : "default"} />
      ) : (
        <Icon icon={icon} size="sm" tone={primary ? "inverse" : "active"} />
      )}
      <Text variant="body" weight={600} tone={primary ? "inverse" : "primary"}>
        {label}
      </Text>
    </PressableScale>
  )
}

function shortMime(mimeType?: string | null): string | null {
  if (!mimeType) return null
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "text/plain": "Teks",
    "text/markdown": "Markdown",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/zip": "ZIP",
  }
  return map[mimeType.toLowerCase()] ?? mimeType.split("/").pop()?.toUpperCase() ?? null
}

/**
 * Tampilan baca berkas teks: mono, pencarian (jumlah + navigasi + sorot),
 * pemotongan jujur bila melebihi batas.
 */
function TextFileView({
  fileName,
  text,
  truncated,
  actions,
}: {
  fileName: string
  text: string
  truncated: boolean
  actions: ReactNode
}) {
  useLanguage()
  const [query, setQuery] = useState("")
  const [activeMatch, setActiveMatch] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const scrollRef = useRef<ScrollViewInstance | null>(null)
  const lineOffsets = useRef(new Map<number, number>())

  const lines = useMemo(() => text.split("\n"), [text])

  // Index semua kemunculan (dibatasi) → daftar {line, start, end}.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: { line: number; start: number; end: number }[] = []
    for (let li = 0; li < lines.length && out.length < SEARCH_MATCH_MAX; li++) {
      const lower = lines[li].toLowerCase()
      let from = 0
      for (;;) {
        const at = lower.indexOf(q, from)
        if (at < 0 || out.length >= SEARCH_MATCH_MAX) break
        out.push({ line: li, start: at, end: at + q.length })
        from = at + Math.max(1, q.length)
      }
    }
    return out
  }, [lines, query])

  const safeActive = matches.length > 0 ? activeMatch % matches.length : 0

  useEffect(() => {
    setActiveMatch(0)
  }, [query])

  const jumpToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return
      const next = (index + matches.length) % matches.length
      setActiveMatch(next)
      const y = lineOffsets.current.get(matches[next].line)
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true })
    },
    [matches],
  )

  const onLineLayout = useCallback(
    (lineIndex: number, hasMatch: boolean) => (event: LayoutChangeEvent) => {
      if (hasMatch) lineOffsets.current.set(lineIndex, event.nativeEvent.layout.y)
    },
    [],
  )

  const matchLines = useMemo(() => {
    const map = new Map<number, { start: number; end: number; global: number }[]>()
    matches.forEach((m, gi) => {
      const arr = map.get(m.line) ?? []
      arr.push({ start: m.start, end: m.end, global: gi })
      map.set(m.line, arr)
    })
    return map
  }, [matches])

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-end gap-2 px-4 py-2">
        <PressableScale
          onPress={() => setSearchOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? "Tutup pencarian" : "Cari dalam berkas"}
          className="items-center justify-center rounded-full bg-overlay-media p-2.5"
        >
          <Icon
            icon={searchOpen ? X : MagnifyingGlass}
            size="sm"
            color={tokens.colors.light.primaryForeground}
          />
        </PressableScale>
        {actions}
      </View>

      {searchOpen ? (
        <View className="gap-2 px-4 pb-2">
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Cari kata…"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => jumpToMatch(safeActive + 1)}
            accessibilityLabel="Cari kata dalam berkas"
          />
          <View className="flex-row items-center justify-between">
            <Text variant="caption" className="text-white tabular-nums">
              {query.trim()
                ? matches.length > 0
                  ? `${safeActive + 1} dari ${matches.length}${matches.length >= SEARCH_MATCH_MAX ? "+" : ""}`
                  : "Tidak ditemukan"
                : "Ketik untuk mencari"}
            </Text>
            <View className="flex-row gap-2">
              <PressableScale
                onPress={() => jumpToMatch(safeActive - 1)}
                disabled={matches.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Hasil sebelumnya"
                className={`rounded-full bg-overlay-media px-4 py-1.5 ${matches.length === 0 ? "opacity-40" : ""}`}
              >
                <Text variant="caption" weight={700} className="text-white">
                  ↑ Sebelumnya
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => jumpToMatch(safeActive + 1)}
                disabled={matches.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Hasil berikutnya"
                className={`rounded-full bg-overlay-media px-4 py-1.5 ${matches.length === 0 ? "opacity-40" : ""}`}
              >
                <Text variant="caption" weight={700} className="text-white">
                  Berikutnya ↓
                </Text>
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-surface"
        contentContainerClassName="p-4"
        accessibilityLabel={translate("Isi berkas {x}", { x: fileName })}
      >
        {lines.map((line, li) => {
          const lineMatches = matchLines.get(li)
          if (!lineMatches || lineMatches.length === 0) {
            return (
              <Text key={li} variant="body" className="font-mono-500" onLayout={onLineLayout(li, false)}>
                {line || " "}
              </Text>
            )
          }
          // Susun segmen normal/sorot untuk baris ini.
          const segments: ReactNode[] = []
          let cursor = 0
          lineMatches.forEach((m, mi) => {
            if (m.start > cursor) segments.push(<Text key={`t${mi}`} variant="inherit">{line.slice(cursor, m.start)}</Text>)
            segments.push(
              <Text
                key={`h${mi}`}
                variant="inherit"
                weight={700}
                className={m.global === safeActive ? "bg-warning" : "bg-warning-soft"}
              >
                {line.slice(m.start, m.end)}
              </Text>,
            )
            cursor = m.end
          })
          if (cursor < line.length) segments.push(<Text key="tail" variant="inherit">{line.slice(cursor)}</Text>)
          return (
            <Text key={li} variant="body" className="font-mono-500" onLayout={onLineLayout(li, true)}>
              {segments}
            </Text>
          )
        })}
        {truncated ? (
          <Text variant="caption" tone="secondary" className="mt-4">
            …Berkas dipotong di {Math.round(TEXT_PREVIEW_MAX_BYTES / 1024)} KB. Unduh untuk membaca seluruhnya.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  )
}
