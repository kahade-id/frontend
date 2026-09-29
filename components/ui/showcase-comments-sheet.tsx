/**
 * Kahade — <ShowcaseCommentsSheet> daftar komentar + KOMPOSER satu item
 * showcase di BottomSheet (revisi audit 2026-09-23).
 *
 * Perbaikan audit Etalase:
 *  - G-01: hitungan header tidak dobel — total = total server + komentar
 *    lokal yang BELUM ada di respons server (fallback halus bila
 *    listShowcaseComments sudah menyertakan komentar yang baru dikirim).
 *  - G-02: sheet hanya memuat 30 komentar root; bila ada lebih, baris bawah
 *    menawarkan "Lihat semua komentar" → halaman detail (paginasi penuh).
 *  - G-03/C-08: state percakapan (komentar lokal) dibuang saat sheet
 *    DITUTUP — tidak ada jendela listing basi.
 *  - G-04: membuka ulang item meng-RELOAD query (lihat kunci `useApiQuery`
 *    yang memuat showcaseId — enabled flip → muat ulang); data komentar dari
 *    kunjungan sebelumnya tidak diasumsikan masih segar. PERF-FIX (network
 *    P2): reload ini memakai cache standar 5 dtk — buka-tutup dalam 5 dtk
 *    tidak menembak jaringan; di atas itu tetap fetch segar.
 *  - F-04 kelas yang sama: komposer dibatasi 1000 karakter (kontrak DTO).
 *  - A-05 kelas yang sama: tamu tidak melihat komposer — tombol "Masuk"
 *    sebagai gantinya (membaca komentar tetap boleh, endpoint publik).
 *
 * Revisi audit Etalase 2026-09-23 / 2026-09-24:
 *  - F-01/C-01 (2026-09-24): komentar TIDAK memanggil markShowcaseFeedDirty().
 *    Satu komentar dari sheet ini dulu memicu refetch feed yang sedang fokus,
 *    membuang halaman 2..N dan menimpa kenaikan hitungan optimistis. Sekarang
 *    setiap mutasi sukses mendaftarkan DELTA ke ledger
 *    `queueShowcaseCommentCount()` (TEPAT SEKALI per mutasi sukses) yang
 *    diterapkan semua permukaan kartu tanpa satu pun request jaringan.
 *  - D-02: hitungan kartu naik lewat ledger yang sama (tanpa dirty).
 *  - E-01: query.error tidak menyembunyikan komentar lokal yang baru terkirim.
 *  - E-02: judul "Komentar {x}" lewat translate.
 *  - E-05: draf disimpan PER ITEM — pindah item / tutup sheet tidak membuang
 *    ketikan; kembali ke item lama memulihkannya. Ganti sesi membuang semua.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { ChatCircle, Copy, Flag, PaperPlaneRight, Trash, X } from "phosphor-react-native"
import { FlatList, View, useWindowDimensions } from "react-native"
import { router } from "expo-router"

import {
  addShowcaseComment,
  deleteShowcaseComment,
  listShowcaseComments,
  type ShowcaseComment,
  type ShowcaseCommentWithReplies,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { createIdempotencyKey, isApiError, userMessage } from "@/lib/api"
import { getMeCached, pickPublicUserId } from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { queueShowcaseCommentCount } from "@/lib/showcase-social-prefs"
import {
  sortShowcaseComments,
  type ShowcaseCommentOrder,
} from "@/lib/showcase-social"
import { SHOWCASE_COMMENT_MESSAGES } from "@/lib/showcase-comment-messages"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { useHasSession } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { tokens } from "@/lib/tokens"

import { ActionSheet } from "@/components/ui/action-sheet"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Divider } from "@/components/ui/divider"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

/** Komentar yang dimuat sekali buka — cukup untuk percakapan di feed. */
const SHEET_COMMENT_LIMIT = 30
/** T2-F03: balasan diringkas 3 baris (selaras layar detail). */
const REPLY_PREVIEW = 3
/** Kontrak DTO CreateShowcaseCommentDto (sumber: constraints.ts, D-08). */
const COMMENT_MAX = API_CONSTRAINTS.CreateShowcaseCommentDto.content.maxLength

type ComposerHandle = { clear: () => void }

type CommentComposerFooterProps = {
  composerRef: MutableRefObject<ComposerHandle | null>
  initialDraft: string
  replyToUsername: string | null
  sending: boolean
  onCancelReply: () => void
  /** Dipanggil dengan isi mentah; induk mengurus trim + API + clear. */
  onSend: (content: string) => Promise<void>
  /** Menulis ke ref draf induk (tanpa setState) — untuk draf per item (E-05). */
  onDraftChange: (value: string) => void
}

/**
 * FE-012 (audit 2026-09-29): komposer footer tersendiri — state draf
 * dikunci di komponen anak (pola composer chat R1-001), sehingga keystroke
 * hanya me-render ulang footer kecil ini, bukan seluruh sheet + FlatList
 * komentar. Induk tetap memegang `draftRef` (draf per item, E-05) lewat
 * `onDraftChange` yang tidak memicu render.
 */
const CommentComposerFooter = memo(function CommentComposerFooter({
  composerRef,
  initialDraft,
  replyToUsername,
  sending,
  onCancelReply,
  onSend,
  onDraftChange,
}: CommentComposerFooterProps) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const [text, setText] = useState(initialDraft)

  useEffect(() => {
    composerRef.current = { clear: () => setText("") }
    return () => {
      composerRef.current = null
    }
  }, [composerRef])

  const handleChange = useCallback(
    (value: string) => {
      setText(value)
      onDraftChange(value)
    },
    [onDraftChange],
  )
  const handleSendPress = useCallback(() => {
    const content = text.trim()
    if (!content || sending) return
    void onSend(text)
  }, [text, sending, onSend])

  return (
    // Wrapper footer sheet sudah px-5 -> tanpa padding horizontal lagi.
    <View className="pb-1">
      {replyToUsername ? (
        <View className="mb-2 flex-row items-center justify-between rounded bg-surface px-3 py-1.5">
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {translate("Membalas @{x}", { x: replyToUsername })}
          </Text>
          <IconButton
            icon={X}
            variant="ghost"
            size="sm"
            accessibilityLabel={translate("Batalkan balasan")}
            onPress={onCancelReply}
          />
        </View>
      ) : null}
      <View className="flex-row items-end gap-2">
        <Input
          disabled={sending}
          value={text}
          onChangeText={handleChange}
          placeholder={replyToUsername ? translate("Tulis balasan…") : "Tulis komentar…"}
          accessibilityLabel={translate("Komentar baru")}
          containerClassName="flex-1"
          maxLength={COMMENT_MAX}
          onSubmitEditing={handleSendPress}
          returnKeyType="send"
        />
        <IconButton
          icon={PaperPlaneRight}
          variant="primary"
          size="sm"
          accessibilityLabel={translate("Kirim komentar")}
          accessibilityHint={translate("Kirim komentar")}
          loading={sending}
          disabled={!text.trim()}
          onPress={handleSendPress}
        />
      </View>
      {/* Item 162 (FE-IMP-1): konter SELALU "X karakter tersisa"
          (bukan format ganda "n/2000"). */}
      <Text variant="caption" tone="secondary" className="pt-1 text-right tabular-nums">
        {translate("{x} karakter tersisa", { x: COMMENT_MAX - text.length })}
      </Text>
    </View>
  )
})

import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { useSessionRevision } from "@/lib/guest-gate"

export type ShowcaseCommentsSheetProps = {
  /** Item yang komentarnya dibuka. `null` = sheet tertutup. */
  item: ShowcaseSocialItem | null
  onRequestClose: () => void
}

export function ShowcaseCommentsSheet({
  item,
  onRequestClose,
}: ShowcaseCommentsSheetProps) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const { height: windowHeight } = useWindowDimensions()
  const toast = useToast()
  const hasSession = useHasSession()
  const showcaseId = item?.id
  const revision = useSessionRevision()
  const operation = useShowcaseOperation(showcaseId)
  const query = useApiQuery(
    `showcase-comments:${revision}:${showcaseId ?? "none"}`,
    (signal) =>
      listShowcaseComments(showcaseId as string, { page: 1, limit: SHEET_COMMENT_LIMIT }, signal),
    Boolean(showcaseId),
    // PERF-FIX (network P2): cache standar 5 dtk (hapus `useCache: false`) —
    // buka-tutup sheet dalam 5 dtk tidak mengunduh ulang komentar yang baru
    // dibaca. Komentar yang diposting dari sheet tampil via state lokal
    // (`localComments`), jadi cache 5 dtk tidak menyembunyikan kiriman.
  )

  /** Item 49 (FE-IMP-1): urutan komentar — Terbaru / Terlama. */
  const [commentOrder, setCommentOrder] = useState<ShowcaseCommentOrder>("newest")
  /** Komentar yang ditulis dari komposer sheet (belum tentu ada di query). */
  const [localComments, setLocalComments] = useState<ShowcaseCommentWithReplies[]>([])
  /**
   * T2-F02 (audit UI/UX 2026-09-28): balasan yang induknya komentar SERVER
   * tidak ada di `localComments`, jadi mapping lama tidak pernah menemukan
   * induknya → balasan tak terlihat sampai sheet dibuka ulang. Sekarang
   * balasan disimpan sebagai patch per parentId dan digabung ke induknya
   * (lokal MAUPUN server) saat render.
   */
  const [replyPatches, setReplyPatches] = useState<Array<{ parentId: string; reply: ShowcaseComment }>>([])
  // FE-012: TIDAK ada lagi `draft` state di level sheet — draf dikunci di
  // <CommentComposerFooter>. `draftRef` tetap di sini untuk draf per item
  // (E-05): ditulis via onDraftChange tanpa setState.
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ShowcaseComment | null>(null)
  const [commentMenu, setCommentMenu] = useState<ShowcaseComment | null>(null)
  // PERF-FIX (TIM1-P2): handler sheet stabil.
  const handleRetryComments = useCallback(() => void query.reload(), [query])
  const handleCloseCommentMenu = useCallback(() => setCommentMenu(null), [])
  /**
   * T2-F03 (audit UI/UX 2026-09-28): semua balasan dirender penuh membuat
   * sheet (maxHeight 55%) sangat panjang — komposer tak terjangkau. Lipat
   * seperti layar detail (REPLY_PREVIEW 3 + tombol "Lihat {x} balasan").
   */
  const [expandedReplies, setExpandedReplies] = useState<ReadonlySet<string>>(new Set())
  const { copy } = useCopy()
  const [meId, setMeId] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSession) {
      setMeId(null)
      return
    }
    try {
      const p = getMeCached?.()
      if (p && typeof p.then === "function") {
        p.then((u) => {
          // SH-F-002 (2026-09-27): meId dibandingkan dengan author.userId
          // (public USR-XXX) — pakai pickPublicUserId (userId publik), BUKAN
          // u.id (cuid internal) yang tidak pernah cocok. Sebelumnya menu
          // "Hapus komentar" tak pernah muncul untuk komentar sendiri.
          setMeId(pickPublicUserId(u))
        }).catch(() => undefined)
      }
    } catch {
      // noop
    }
  }, [hasSession])

  const isMine = useCallback(
    (c: ShowcaseComment) => meId != null && c.author.userId === meId,
    [meId],
  )

  const handleDeleteComment = useCallback(
    async (target: ShowcaseComment) => {
      try {
        await deleteShowcaseComment(target.id)
        toast.show({ title: translate("Komentar dihapus"), tone: "success" })
        setLocalComments((prev) =>
          prev
            .filter((c) => c.id !== target.id)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== target.id),
            })),
        )
        // T2-F02: buang juga patch balasan sesi ini (kalau tidak, reload di
        // bawah menempelkannya kembali walau sudah dihapus).
        setReplyPatches((prev) => prev.filter((p) => p.reply.id !== target.id))
        void query.reload()
      } catch (err) {
        toast.show({
          title: translate("Gagal menghapus komentar"),
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [toast, query],
  )

  /** E-05 (audit 2026-09-23): draf PER ITEM — dipulihkan saat kembali. */
  const draftsFor = useRef<Map<string, string>>(new Map())
  /**
   * S-03 (audit 2026-09-24): satu Idempotency-Key per (item × isi komentar).
   * Percobaan ulang setelah timeout memakai kunci yang SAMA, jadi komentar
   * tidak tercatat dua kali; isi komentar berbeda = aksi berbeda = kunci baru.
   */
  const sendKey = useRef<{ item: string; content: string; key: string } | null>(null)
  const draftOwner = useRef<string | null>(null)
  const draftRef = useRef("")
  /** FE-012: imperative handle komposer anak — untuk mengosongkan input setelah kirim sukses. */
  const composerRef = useRef<ComposerHandle | null>(null)
  // FE-012: draf ditulis ke ref saja (tanpa setState) — keystroke tidak
  // me-render ulang sheet.
  const handleDraftChange = useCallback((value: string) => {
    draftRef.current = value
  }, [])
  const cancelReply = useCallback(() => setReplyTo(null), [])

  /**
   * G-03/C-08: tutup sheet = buang komentar lokal (listing basi). E-05:
   * draf dipertahankan untuk item yang sama — hanya ganti item / ganti sesi
   * yang membuangnya.
   */
  useEffect(() => {
    const next = showcaseId ?? null
    const prev = draftOwner.current
    if (prev !== next) {
      if (prev != null && draftRef.current) draftsFor.current.set(prev, draftRef.current)
      draftOwner.current = next
      // FE-012: restore draf untuk komposer anak (key = draftKey di bawah me-remount).
      draftRef.current = (next != null ? draftsFor.current.get(next) : undefined) ?? ""
    }
    setLocalComments([])
    setReplyPatches([])
    setExpandedReplies(new Set())
    setSending(false)
    setReplyTo(null)
    setCommentMenu(null)
  }, [showcaseId, revision])

  /** Ganti sesi = ganti pemilik draf — buang semuanya (privasi). */
  useEffect(() => {
    draftsFor.current.clear()
    draftRef.current = ""
  }, [revision])

  // FE-012: kunci remount komposer = item × sesi; draf awal dipulihkan dari
  // draftsFor (E-05) saat render — tanpa state draf di level sheet.
  const composerKey = `${showcaseId ?? "none"}:${revision}`
  const composerInitialDraft = showcaseId != null ? (draftsFor.current.get(showcaseId) ?? "") : ""

  const handleSend = useCallback(
    async (rawContent: string) => {
      if (!showcaseId || !hasSession) return
    const content = rawContent.trim()
    if (!content || sending) return
    const task = operation.begin()
    if (!task) return
    setSending(true)
    try {
      const keyed = sendKey.current?.item === showcaseId && sendKey.current?.content === content
        ? sendKey.current.key
        : (sendKey.current = { item: showcaseId, content, key: createIdempotencyKey() }).key
      const saved = await addShowcaseComment(
        showcaseId,
        { content, parentId: replyTo?.id },
        keyed,
      )
      // Kontrak tests/showcase-comments-lifecycle: delta TEPAT SEKALI per
      // mutasi sukses — bahkan saat respons telat mendarat di item lain
      // (komentar memang tercipta di server → hitungan berubah). Ledger
      // menggantikan markShowcaseFeedDirty supaya tidak ada refetch yang
      // membuang halaman 2..N (F-01/C-01 audit 2026-09-24).
      queueShowcaseCommentCount(showcaseId, 1)
      if (!task.valid()) return
      if (replyTo?.id) {
        // T2-F02: gabung ke induk lokal MAUPUN server (patch per parentId).
        setReplyPatches((previous) => [...previous, { parentId: replyTo.id, reply: saved }])
      } else {
        setLocalComments((previous) => [{ ...saved, replies: [] }, ...previous])
      }
      // Kiriman ini tuntas — teks yang sama berikutnya adalah aksi BARU.
      sendKey.current = null
      setReplyTo(null)
      // FE-012: kosongkan komposer anak hanya bila draf tak berubah selama
      // kirim (penjaga balapan — perilaku lama via updateDraft("")).
      if (draftRef.current.trim() === content) {
        draftRef.current = ""
        composerRef.current?.clear()
      }
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        // D-01: label bersama dengan layar detail (satu sumber copy).
        title: SHOWCASE_COMMENT_MESSAGES.sendFailed,
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      if (task.valid()) setSending(false)
      task.finish()
    }
  }, [showcaseId, sending, toast.show, hasSession, operation, replyTo])

  const localIds = new Set(localComments.map((c) => c.id))
  const serverComments = query.data?.data.filter((c) => !localIds.has(c.id)) ?? []
  // Item 49: urutkan sisi klien (backend tidak punya param sort untuk
  // komentar) — deterministik, seri dipecah id.
  // T2-F02: tempel balasan sesi ini ke induknya (lokal maupun server).
  const comments = useMemo(() => {
    const patched = [...localComments, ...serverComments].map((c) => {
      const extra = replyPatches.filter((p) => p.parentId === c.id).map((p) => p.reply)
      return extra.length > 0 ? { ...c, replies: [...(c.replies ?? []), ...extra] } : c
    })
    return sortShowcaseComments(patched, commentOrder)
  }, [localComments, serverComments, commentOrder, replyPatches])

  /**
   * G-01: total = total server + komentar lokal yang BELUM tercakup server.
   * (Fallback halus untuk respons yang sudah memuat komentar lokal —
   * tanpa dedupe ini hitungan header dobel setelah kirim+buka ulang.)
   */
  const serverTotal = query.data?.total ?? item?.commentCount ?? 0
  const serverIds = new Set((query.data?.data ?? []).map((c) => c.id))
  const localOnlyCount = localComments.filter((c) => !serverIds.has(c.id)).length
  const total = serverTotal + localOnlyCount

  const loading = query.loading && query.data == null
  /** G-02: mungkin masih ada komentar di luar halaman sheet. */
  const maybeMore = comments.length >= SHEET_COMMENT_LIMIT || total > comments.length

  const handleSeeAll = useCallback(() => {
    if (!showcaseId) return
    onRequestClose()
    router.push(ROUTES.showcaseDetail(showcaseId))
  }, [showcaseId, onRequestClose])

  /**
   * R1-004 (2026-09-29, audit render-perf): daftar komentar tervirtualisasi
   * — dulu ScrollView + map me-mount ~120 baris sekaligus (30 root × 3
   * balasan preview). `renderItem` stabil via useCallback + baris di-memo.
   */
  const commentKeyExtractor = useCallback((c: ShowcaseCommentWithReplies) => c.id, [])
  const handleCommentReply = useCallback((c: ShowcaseComment) => setReplyTo(c), [])
  const handleCommentMenu = useCallback((c: ShowcaseComment) => setCommentMenu(c), [])
  const handleToggleReplies = useCallback((rootId: string) => {
    setExpandedReplies((current) => {
      const next = new Set(current)
      if (next.has(rootId)) next.delete(rootId)
      else next.add(rootId)
      return next
    })
  }, [])
  const renderComment = useCallback(
    ({ item: root }: { item: ShowcaseCommentWithReplies }) => {
      const replies = root.replies ?? []
      // T2-F03: ringkas balasan (3 pertama), tombol buka/tutup lipatan.
      const expanded = expandedReplies.has(root.id)
      const visibleReplies = expanded ? replies : replies.slice(0, REPLY_PREVIEW)
      const hiddenCount = replies.length - visibleReplies.length
      return (
        // Balasan dikirim sebagai ANAK komentar induk (revisi 2026-09-26):
        // garis utas di kolom avatar induk turun menyambung balasan, dan
        // indentasinya mengikuti lebar avatar + gap.
        <ShowcaseCommentRow
          comment={root}
          isMine={isMine(root)}
          canReply={hasSession}
          menuable={true}
          onReply={handleCommentReply}
          onOpenMenu={handleCommentMenu}
          threaded={visibleReplies.length > 0}
        >
          {visibleReplies.map((reply) => (
            <ShowcaseCommentRow
              key={reply.id}
              comment={reply}
              avatarSize="xs"
              isMine={isMine(reply)}
              canReply={false}
              menuable={true}
              onOpenMenu={handleCommentMenu}
            />
          ))}
          {replies.length > REPLY_PREVIEW ? (
            <Button variant="ghost" onPress={() => handleToggleReplies(root.id)}>
              {expanded
                ? translate("Tutup balasan")
                : translate("Lihat {x} balasan", { x: hiddenCount })}
            </Button>
          ) : null}
        </ShowcaseCommentRow>
      )
    },
    [expandedReplies, hasSession, isMine, handleCommentReply, handleCommentMenu, handleToggleReplies],
  )
  // Tinggi maks 55% window: nilai runtime -> style, bukan className.
  const commentListStyle = useMemo(() => ({ maxHeight: windowHeight * 0.55 }), [windowHeight])
  // List selaras title: px-5 sama dengan header sheet (gap & indent konsisten).
  // Nilai = className lama "gap-4 px-5 pb-6 pt-1" pada View pembungkus.
  const commentListContentStyle = useMemo(
    () => ({
      gap: tokens.space[4],
      paddingHorizontal: tokens.space[5],
      paddingBottom: tokens.space[6],
      paddingTop: tokens.space[1],
    }),
    [],
  )
  const commentListFooter = useMemo(
    () =>
      // G-02: jalan membaca komentar di luar 30 pertama.
      maybeMore ? (
        <Button variant="secondary" onPress={handleSeeAll}>
          Lihat semua komentar
        </Button>
      ) : null,
    [maybeMore, handleSeeAll],
  )

  // Header: "Komentar  12" — count di samping. E-02: lewat `translate`.
  const headerTitle = total > 0 ? translate("Komentar {x}", { x: formatNumber(total) }) : translate("Komentar")

  return (
    <BottomSheet
      avoidKeyboard
      visible={item != null}
      onRequestClose={onRequestClose}
      title={headerTitle}
      padding="none"
      footer={
        // Wrapper footer sheet sudah px-5 -> tanpa padding horizontal lagi.
        hasSession ? (
          // FE-012: draf dikunci di komponen anak (key = item × sesi) —
          // keystroke tidak me-render ulang sheet/list.
          <CommentComposerFooter
            key={composerKey}
            composerRef={composerRef}
            initialDraft={composerInitialDraft}
            replyToUsername={replyTo?.author.username ?? null}
            sending={sending}
            onCancelReply={cancelReply}
            onSend={handleSend}
            onDraftChange={handleDraftChange}
          />
        ) : (
          // A-05 (kelas): tamu tidak melihat komposer — ajakan login.
          <View className="pb-1">
            <Button onPress={() => router.push(ROUTES.loginRequired(`/showcase/${encodeURIComponent(showcaseId ?? "")}`))}>
              Masuk untuk berkomentar
            </Button>
          </View>
        )
      }
    >
      {/* Pemisah di bawah title — FULL-BLEED (revisi 2026-09-23: dulu inset
          mx-5 mulai dari tepi teks komentar; permintaan produk: garis ini
          menyambung dua tepi layar seperti header sheet, bukan mengikuti
          indent konten). */}
      <Divider className="mb-3" />

      {/* Item 49 (FE-IMP-1): pengatur urutan komentar — Terbaru / Terlama.
          Hanya tampil bila ada ≥2 komentar yang bisa diurutkan. */}
      {comments.length >= 2 ? (
        <View className="flex-row items-center justify-end gap-2 px-5 pb-2">
          <Text variant="caption" tone="secondary">
            {translate("Urutkan:")}
          </Text>
          <Chip
            selected={commentOrder === "newest"}
            accessibilityState={{ selected: commentOrder === "newest" }}
            accessibilityLabel={translate("Urutkan komentar terbaru dulu")}
            onPress={() => setCommentOrder("newest")}
          >
            {translate("Terbaru")}
          </Chip>
          <Chip
            selected={commentOrder === "oldest"}
            accessibilityState={{ selected: commentOrder === "oldest" }}
            accessibilityLabel={translate("Urutkan komentar terlama dulu")}
            onPress={() => setCommentOrder("oldest")}
          >
            {translate("Terlama")}
          </Chip>
        </View>
      ) : null}

      {loading ? (
        <SkeletonGroup className="gap-4 px-5 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            // PERF-FIX (state audit): key stabil ber-prefix.
            <View key={`comment-skeleton-${index}`} className="flex-row items-start gap-2">
              <Skeleton shape="circle" width={24} height={24} />
              <View className="flex-1 gap-2">
                <Skeleton height={14} className="w-2/5" />
                <Skeleton height={14} className="w-4/5" />
              </View>
            </View>
          ))}
        </SkeletonGroup>
      ) : query.error && comments.length === 0 ? (
        // E-01 (audit 2026-09-23): error query TIDAK menyembunyikan komentar
        // lokal yang baru terkirim — error hanya tampil bila tak ada yang bisa
        // ditampilkan.
        <View className="px-5 pb-2">
          <ErrorState
            compact
            title="Gagal memuat komentar"
            description={query.error}
            onRetry={handleRetryComments}
          />
        </View>
      ) : comments.length === 0 ? (
        <View className="flex-row items-center gap-2 px-5 pb-6">
          <Icon icon={ChatCircle} size="sm" tone="default" />
          <Text variant="body" tone="secondary">
            Belum ada komentar. Jadilah yang pertama!
          </Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={commentKeyExtractor}
          renderItem={renderComment}
          style={commentListStyle}
          contentContainerStyle={commentListContentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={commentListFooter}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={false}
        />
      )}

      <ActionSheet
        visible={commentMenu != null}
        onRequestClose={handleCloseCommentMenu}
        title="Opsi Komentar"
        actions={[
          ...(commentMenu && !commentMenu.parentId && hasSession
            ? [
                {
                  key: "reply",
                  label: "Balas komentar",
                  icon: ChatCircle,
                  onPress: () => {
                    const target = commentMenu
                    setCommentMenu(null)
                    setReplyTo(target)
                  },
                },
              ]
            : []),
          ...(commentMenu
            ? [
                {
                  key: "copy",
                  label: "Salin teks",
                  icon: Copy,
                  onPress: () => {
                    const text = commentMenu.content
                    setCommentMenu(null)
                    void copy(text)
                  },
                },
              ]
            : []),
          ...(commentMenu && (isMine(commentMenu) || item?.isOwner)
            ? [
                {
                  key: "delete",
                  label: "Hapus komentar",
                  icon: Trash,
                  destructive: true,
                  onPress: () => {
                    const target = commentMenu
                    setCommentMenu(null)
                    void handleDeleteComment(target)
                  },
                },
              ]
            : []),
          ...(commentMenu && !isMine(commentMenu)
            ? [
                {
                  key: "report",
                  label: "Laporkan komentar",
                  icon: Flag,
                  onPress: () => {
                    setCommentMenu(null)
                    if (showcaseId) router.push(ROUTES.showcaseDetail(showcaseId))
                  },
                },
              ]
            : []),
        ]}
      />
    </BottomSheet>
  )
}
