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
 *    kunjungan sebelumnya tidak diasumsikan masih segar.
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

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatCircle, Copy, Flag, PaperPlaneRight, Trash, X } from "phosphor-react-native"
import { ScrollView, View, useWindowDimensions } from "react-native"
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
import { getMeCached } from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { queueShowcaseCommentCount } from "@/lib/showcase-social-prefs"
import { SHOWCASE_COMMENT_MESSAGES } from "@/lib/showcase-comment-messages"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useHasSession } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { ActionSheet } from "@/components/ui/action-sheet"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
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
/** Kontrak DTO CreateShowcaseCommentDto (sumber: constraints.ts, D-08). */
const COMMENT_MAX = API_CONSTRAINTS.CreateShowcaseCommentDto.content.maxLength

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
    { useCache: false },
  )

  /** Komentar yang ditulis dari komposer sheet (belum tentu ada di query). */
  const [localComments, setLocalComments] = useState<ShowcaseCommentWithReplies[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ShowcaseComment | null>(null)
  const [commentMenu, setCommentMenu] = useState<ShowcaseComment | null>(null)
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
          if (u?.id) setMeId(u.id)
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
        toast.show({ title: "Komentar dihapus", tone: "success" })
        setLocalComments((prev) =>
          prev
            .filter((c) => c.id !== target.id)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== target.id),
            })),
        )
        void query.reload()
      } catch (err) {
        toast.show({
          title: "Gagal menghapus komentar",
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
  const updateDraft = useCallback((value: string) => {
    draftRef.current = value
    setDraft(value)
  }, [])

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
      const restored = (next != null ? draftsFor.current.get(next) : undefined) ?? ""
      draftRef.current = restored
      setDraft(restored)
    }
    setLocalComments([])
    setSending(false)
    setReplyTo(null)
    setCommentMenu(null)
  }, [showcaseId, revision])

  /** Ganti sesi = ganti pemilik draf — buang semuanya (privasi). */
  useEffect(() => {
    draftsFor.current.clear()
    draftRef.current = ""
    setDraft("")
  }, [revision])

  const handleSend = useCallback(async () => {
    if (!showcaseId || !hasSession) return
    const content = draft.trim()
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
        setLocalComments((previous) =>
          previous.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies ?? []), saved] } : c,
          ),
        )
      } else {
        setLocalComments((previous) => [{ ...saved, replies: [] }, ...previous])
      }
      // Kiriman ini tuntas — teks yang sama berikutnya adalah aksi BARU.
      sendKey.current = null
      setReplyTo(null)
      if (draftRef.current.trim() === content) updateDraft("")
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
  }, [showcaseId, draft, sending, toast.show, hasSession, operation, replyTo, updateDraft])

  const localIds = new Set(localComments.map((c) => c.id))
  const serverComments = query.data?.data.filter((c) => !localIds.has(c.id)) ?? []
  const comments = [...localComments, ...serverComments]

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
          <View className="pb-1">
            {replyTo ? (
              <View className="mb-2 flex-row items-center justify-between rounded bg-surface px-3 py-1.5">
                <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
                  {translate("Membalas @{x}", { x: replyTo.author.username })}
                </Text>
                <IconButton
                  icon={X}
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={translate("Batalkan balasan")}
                  onPress={() => setReplyTo(null)}
                />
              </View>
            ) : null}
            <View className="flex-row items-end gap-2">
              <Input
                disabled={sending}
                value={draft}
                onChangeText={updateDraft}
                placeholder={replyTo ? translate("Tulis balasan…") : "Tulis komentar…"}
                accessibilityLabel="Komentar baru"
                containerClassName="flex-1"
                maxLength={COMMENT_MAX}
                onSubmitEditing={() => void handleSend()}
                returnKeyType="send"
              />
              <IconButton
                icon={PaperPlaneRight}
                variant="primary"
                size="sm"
                accessibilityLabel="Kirim komentar"
                accessibilityHint={translate("Kirim komentar")}
                loading={sending}
                disabled={!draft.trim()}
                onPress={() => void handleSend()}
              />
            </View>
            {/* D-19 (audit 2026-09-23): batas 2000 dulu memotong senyap di tengah
                kalimat. Konter muncul saat mendekati batas supaya jeda penulisan
                tidak mengejutkan. */}
            {draft.length >= COMMENT_MAX - 200 ? (
              <Text className="mt-1 text-right text-2xs text-neutral-400">
                {draft.length}/{COMMENT_MAX}
              </Text>
            ) : null}
          </View>
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

      {loading ? (
        <SkeletonGroup className="gap-4 px-5 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} className="flex-row items-start gap-2">
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
            onRetry={() => void query.reload()}
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
        // Tinggi maks 55% window: nilai runtime -> style, bukan className.
        // List selaras title: px-5 sama dengan header sheet (gap & indent konsisten)
        <ScrollView
          style={{ maxHeight: windowHeight * 0.55 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 px-5 pb-6 pt-1">
            {/* Pemisah antar komentar DIHAPUS (2026-09-23): jarak (gap-4) cukup
                memisahkan utas; satu-satunya garis di sheet ini adalah di bawah
                title (full-bleed) dan border atas footer komposer — "atas aksi
                paling bawah". */}
            {comments.map((root) => {
              const replies = root.replies ?? []
              return (
                <View key={root.id}>
                  {/*
                    Balasan dikirim sebagai ANAK komentar induk (revisi
                    2026-09-26): garis utas di kolom avatar induk turun
                    menyambung balasan, dan indentasinya mengikuti lebar
                    avatar + gap — bukan angka ml-8 yang dirawat terpisah.
                  */}
                  <ShowcaseCommentRow
                    comment={root}
                    isMine={isMine(root)}
                    canReply={hasSession}
                    menuable={true}
                    onReply={(c) => setReplyTo(c)}
                    onOpenMenu={(c) => setCommentMenu(c)}
                    threaded={replies.length > 0}
                  >
                    {replies.map((reply) => (
                      <ShowcaseCommentRow
                        key={reply.id}
                        comment={reply}
                        avatarSize="xs"
                        isMine={isMine(reply)}
                        canReply={false}
                        menuable={true}
                        onOpenMenu={(c) => setCommentMenu(c)}
                      />
                    ))}
                  </ShowcaseCommentRow>
                </View>
              )
            })}
            {maybeMore ? (
              // G-02: jalan membaca komentar di luar 30 pertama.
              <Button variant="secondary" onPress={handleSeeAll}>
                Lihat semua komentar
              </Button>
            ) : null}
          </View>
        </ScrollView>
      )}

      <ActionSheet
        visible={commentMenu != null}
        onRequestClose={() => setCommentMenu(null)}
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
