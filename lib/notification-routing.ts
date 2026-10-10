/**
 * Kahade — notifikasi → route tujuan (list Notifikasi & tap push).
 *
 * Spec `GET /v1/notifications` dan payload push TIDAK mendokumentasikan
 * bentuk referensi (UNVERIFIED). Kami menerima dua sumber yang lazim:
 *   1. `referenceType` + `referenceId` pada item notifikasi
 *      (dinormalisasi dari `refType`/`refId` aktual backend — BFI-116;
 *      mis. ORDER/abc, DISPUTE/xyz, WALLET_TRANSACTION/123, CHAT_ROOM/…,
 *      SUPPORT_TICKET/…, USER/<username>, KYC/*, ORDER_LINK/<token>)
 *   2. `data` payload push (expo-notifications) dengan kunci yang sama
 *      (`refType`/`refId`, `referenceType`/`referenceId`) atau
 *      `type`/`id`/`orderId`/…
 *
 * Pencocokan tipe TIDAK case-sensitive dan menoleransi variasi
 * (`order`, `ORDER`, `Order`, `order_link`, `orderLink`). Bila tidak
 * dikenali → `null`; pemanggil membuka tab Notifikasi / tidak navigasi.
 *
 * Satu tempat untuk pemetaan ini supaya list notifikasi dan handler push
 * tidak punya dua tabel yang diam-diam berbeda.
 */
import type { Href } from "expo-router"

import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { getWalletEnabled } from "@/lib/wallet-flag"
import { hrefPathname, isWalletOnlyPath, walletRouteFallback } from "@/lib/wallet-routes"

export type NotificationReference = {
  referenceType?: string | null
  referenceId?: string | null
  /** Fallback: path backend (mis. `/chat/<id>`) bila referenceType/Id kosong. */
  actionUrl?: string | null
  /**
   * SH-F-008 (audit 2026-09-27): id komentar untuk deep-link highlight
   * (`?comment=<id>` di detail etalase). Payload backend saat ini TIDAK
   * mendokumentasikan field ini — gap kontrak; bila tak tersedia, route
   * jatuh ke detail polos (highlight tidak menyala).
   */
  commentId?: string | null
}

/** Normalisasi "Order_Link" / "order-link" / "orderLink" → "orderlink" */
function normalizeType(t: string): string {
  return t.replace(/[\s_-]/g, "").toLowerCase()
}

/**
 * Mode Tanpa Wallet Internal: tulis ulang target notifikasi/push yang
 * menunjuk layar khusus-dompet saat kill-switch mati.
 *
 * - `/withdraw` (legacy, penarikan saldo lama) dibiarkan — layar itu
 *   satu-satunya yang tetap hidup.
 * - riwayat & detail mutasi → `/transactions` (konteks terdekat yang hidup);
 *   dompet/topup/transfer/receive/jadwal → `/bank-accounts`.
 * - wallet nyala / target bukan dompet → tidak diubah.
 *
 * Idempoten: hasil fallback bukan path dompet, jadi pemanggilan ganda aman.
 */
function applyWalletFallback(target: Href | null): Href | null {
  if (!target || getWalletEnabled()) return target
  const path = hrefPathname(target)
  if (!isWalletOnlyPath(path)) return target
  return walletRouteFallback(path) as Href
}

/**
 * Route untuk sebuah referensi; `null` bila tidak dikenali / id kosong.
 * Tipe tanpa id (KYC, WALLET) tetap punya tujuan.
 * Bila `referenceType` kosong, coba parse `actionUrl` sebagai fallback.
 *
 * Mode Tanpa Wallet Internal: hasil akhir dilewatkan `applyWalletFallback` —
 * tap notifikasi tidak boleh mendarat di layar blokir dompet.
 */
export function routeForNotificationReference(ref: NotificationReference): Href | null {
  return applyWalletFallback(routeForNotificationReferenceRaw(ref))
}

/** Pemetaan mentah referensi → route, tanpa fallback kill-switch dompet. */
function routeForNotificationReferenceRaw(ref: NotificationReference): Href | null {
  const type = ref.referenceType ? normalizeType(ref.referenceType) : ""
  const id = ref.referenceId?.trim() ?? ""
  if (!type) return routeForActionUrl(ref.actionUrl)

  // NCC-003: tipe push turunan (DISPUTE_SUBMITTED, DISPUTE_DECISION,
  // DISPUTE_EVIDENCE_SUBMITTED, DISPUTE_CLAIM_SUBMITTED, DISPUTE_ESCALATED,
  // DISPUTE_MESSAGE_RECEIVED, DISPUTE_RESOLVED) dinormalisasi menjadi
  // `disputesubmitted` dst. — tangani seluruh keluarga via prefix agar tap
  // notifikasi sengketa (push maupun inbox) membuka detail sengketa.
  if (type.startsWith("dispute")) return id ? ROUTES.disputeDetail(id) : ROUTES.disputes
  // NCC-004: keluarga MILESTONE_* (MILESTONE_RELEASED dsb.) → detail milestone.
  if (type.startsWith("milestone")) return id ? ROUTES.milestoneDetail(id) : null

  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return id ? ROUTES.orderDetail(id) : ROUTES.transactions
    case "orderlink":
      return id ? ROUTES.orderLink(id) : ROUTES.orderLinks
    case "dispute":
      return id ? ROUTES.disputeDetail(id) : ROUTES.disputes
    case "milestone":
      // NCC-004: `refType: 'MILESTONE'` dari notifyMilestone → detail milestone.
      return id ? ROUTES.milestoneDetail(id) : null
    case "feedback":
      // FAL-018: `refType: 'FEEDBACK'` dari admin-feedback = balasan admin
      // atas masukan user. Tidak ada endpoint/layar detail feedback di sisi
      // user → arahkan ke tiket bantuan (lihat komentar FAL-018 di
      // routeForActionUrlRaw).
      return ROUTES.support
    case "wallettransaction":
    case "wallettx":
    case "topup":
    case "withdraw":
    case "withdrawal":
    case "transfer":
      return id ? ROUTES.walletTransaction(id) : ROUTES.wallet
    case "wallet":
      return ROUTES.wallet
    case "chat":
    case "chatroom":
    case "message":
    // Nilai `type`/`notificationType` di payload push backend untuk pesan chat:
    // `type: "CHAT_NEW"` (chat.service) dan enum `CHAT_NEW_MESSAGE`. Tanpa
    // alias ini, push chat yang tiba TANPA `actionUrl` jatuh ke tab Notifikasi
    // alih-alih membuka ruang chat.
    case "chatnew":
    case "chatnewmessage":
      return id ? ROUTES.chatRoom(id) : ROUTES.chat
    case "supportticket":
    case "ticket":
    case "support":
    // F15: backend mengirim `SUPPORT_TICKET_UPDATE` saat status tiket berubah
    // (admin-support.service → emitNotificationCreated).
    case "supportticketupdate":
      return id ? ROUTES.supportTicket(id) : ROUTES.support
    case "supportconversation":
    case "supportagentreply":
    case "supportchatreply":
      // Audit 2026-10-10 (FE-08/FE-17): balasan agen livechat —
      // `refType: SUPPORT_CONVERSATION` (support-chat.service) dan push
      // `type: SUPPORT_CHAT_REPLY` / enum SUPPORT_AGENT_REPLY. Layar livechat
      // menemukan percakapan aktif user sendiri (tanpa id di rute); dulu
      // jatuh ke null / detail TIKET yang salah.
      return ROUTES.supportChat
    case "user":
    case "profile":
    case "follow":
    case "follower":
      return id ? ROUTES.userProfile(id) : null
    case "kyc":
    case "verification":
      return ROUTES.kyc
    case "subscription":
      return ROUTES.subscriptions
    case "referral":
      return ROUTES.referral
    case "rating":
    case "review":
      return ROUTES.ratings
    case "showcase":
    case "etalase":
    case "showcaselike":
      // Audit Etalase I-02: notifikasi suka karya → detail item.
      return id ? ROUTES.showcaseDetail(id) : ROUTES.showcase
    case "showcasecomment": {
      // SH-F-008: teruskan id komentar bila payload menyediakannya agar
      // highlight `?comment=` di detail menyala; tanpa id komentar → detail
      // polos (gap kontrak payload, bukan bug routing).
      const comment = ref.commentId?.trim()
      return id ? ROUTES.showcaseDetail(id, { comment: comment || undefined }) : ROUTES.showcase
    }
    case "showcasereport":
      // SYS-C-402: update status laporan moderasi → daftar "Laporan saya".
      // FE tidak punya layar detail moderasi (moderasi di panel admin);
      // refId backend = reporterId (BUKAN reportId — gap backend SYS-C-402),
      // jadi id tidak dipakai untuk navigasi.
      return ROUTES.reports()
    case "usershowcase":
      // SYS-C-402: takedown/pembatasan item milik user → feed etalase.
      // SENGAJA bukan showcaseDetail(id): refId backend = ownerId (BUKAN
      // item.id) — detail akan membuka item yang salah/tidak ada. Backend
      // perlu mengirim item.id (pola :2250-2251) sebelum ini bisa deep.
      return ROUTES.showcase
    case "reportappeal":
      // SYS-C-402: hasil banding → feed etalase. FE tidak punya layar
      // detail banding; item yang dipulihkan muncul lagi di etalase.
      return ROUTES.showcase
    case "accountdeletion":
      // SYS-C-402: notifikasi penghapusan akun → layar status khusus.
      return ROUTES.deletionStatus
    case "ratingnew":
      // SYS-C-402: push `data: { type: 'RATING_NEW' }` (ratings.service,
      // tanpa refType/refId) dinormalisasi menjadi `ratingnew` — bukan
      // `rating` yang sudah ada. Arahkan ke daftar ulasan.
      return ROUTES.ratings
    case "kycapproved":
      // SYS-C-402: push `data: { type: 'KYC_APPROVED' }` (tanpa refType)
      // dinormalisasi menjadi `kycapproved` — bukan `kyc` yang sudah ada.
      return ROUTES.kyc
    case "security":
    case "session":
    case "login":
      return ROUTES.security
    case "questions":
    case "question":
      // FAL-020: `refType: 'QUESTION'` (push tanpa actionUrl) → daftar
      // pertanyaan, BUKAN tab notifikasi. Tidak ada rute detail per
      // pertanyaan di ROUTES — id diabaikan.
      return ROUTES.questions
    case "returns":
    case "return":
      // FAL-016: keluarga notifikasi retur → detail retur (spesifik — soal
      // uang, jangan sampai nyasar). Tanpa id → tab Transaksi: entri daftar
      // "Retur Saya" dihapus dari drawer (Poin 1) — retur kini diakses
      // per-order dari detail transaksi.
      return id ? ROUTES.returnDetail(id) : ROUTES.transactions
    case "products":
    case "product":
      // FAL-017: "Katalog Publik" dihapus dari navigasi (Poin 1; model
      // katalog dihapus total di Poin 4) — notifikasi stok/produk kini
      // mendarat di Kelola Etalase, rumah baru "Produk & Stok Saya".
      return ROUTES.showcaseManagement
    case "servicebookings":
    case "servicebooking":
      // Unified v2: booking jasa = kategori JASA di tab Transaksi —
      // buka tab dengan filter kategori JASA.
      return ROUTES.transactionsFiltered({ category: "JASA" })
    case "ordershipped":
    case "ordership":
    case "shipment":
      // FAL-019: ORDER_SHIPPED (dinormalisasi) → detail pelacakan. Id diambil
      // dari kandidat referenceId (shipmentId) di routeForPushDataRaw.
      return id ? ROUTES.trackingDetail(id) : null
    default:
      return routeForTypeFamily(type, id)
  }
}

/**
 * Audit Notifikasi 2026-10-10 (FE-37): keluarga tipe (awalan enum) sebagai
 * jaring terakhir. Push tanpa `actionUrl` — atau inbox yang refType-nya enum
 * penuh — membawa ORDER_PAYMENT_RECEIVED, WALLET_TOPUP_SUCCESS,
 * SECURITY_NEW_LOGIN, KYC_REJECTED, SUBSCRIPTION_EXPIRED, … yang dulu jatuh
 * ke `default: null` (→ tab Notifikasi) karena tabel hanya kenal kata dasar
 * ("order", "wallet", "kyc"). Dipanggil SETELAH switch: alias spesifik
 * (orderlink, ordershipped, wallettransaction, kycapproved, …) tetap menang.
 */
function routeForTypeFamily(type: string, id: string): Href | null {
  if (type.startsWith("order")) return id ? ROUTES.orderDetail(id) : ROUTES.transactions
  if (type.startsWith("wallet")) return id ? ROUTES.walletTransaction(id) : ROUTES.wallet
  // Dana tertahan karena belum ada rekening (actionUrl backend `/bank-accounts`).
  if (type === "escrowheldnobank") return ROUTES.bankAccounts
  if (type.startsWith("chat")) return id ? ROUTES.chatRoom(id) : ROUTES.chat
  if (type.startsWith("security")) return ROUTES.security
  if (type.startsWith("kyc") || type.startsWith("businessverification")) return ROUTES.kyc
  if (type.startsWith("subscription")) return ROUTES.subscriptions
  if (type.startsWith("referral")) return ROUTES.referral
  if (type.startsWith("rating")) return ROUTES.ratings
  if (type.startsWith("badge") || type.startsWith("rank")) return ROUTES.badges
  if (type.startsWith("voucher")) return ROUTES.vouchers
  if (type.startsWith("return")) return id ? ROUTES.returnDetail(id) : ROUTES.transactions
  return null
}

/** Label CTA sejajar {@link routeForTypeFamily}. */
function labelForTypeFamily(type: string, id: string): string | null {
  if (type.startsWith("order")) return translate("Lihat pesanan")
  if (type.startsWith("wallet")) return id ? translate("Lihat mutasi") : translate("Buka dompet")
  if (type === "escrowheldnobank") return translate("Daftarkan rekening")
  if (type.startsWith("chat")) return translate("Buka chat")
  if (type.startsWith("security")) return translate("Buka keamanan")
  if (type.startsWith("kyc") || type.startsWith("businessverification")) return translate("Buka verifikasi")
  if (type.startsWith("subscription")) return translate("Lihat langganan")
  if (type.startsWith("referral")) return translate("Lihat referral")
  if (type.startsWith("rating")) return translate("Lihat ulasan")
  if (type.startsWith("badge") || type.startsWith("rank")) return translate("Lihat lencana")
  if (type.startsWith("voucher")) return translate("Lihat voucher")
  if (type.startsWith("return")) return translate("Lihat retur")
  return null
}

/**
 * Audit Notifikasi 2026-10-10 (FE-30/FE-45): rute hasil resolusi adalah tab
 * inbox itu sendiri (`/notifications` tanpa id, `/badges`)? Pemanggil di
 * inbox dan layar detail harus memperlakukannya sebagai "tidak ada tautan":
 * `router.push` ke tab yang sedang terbuka adalah no-op (ketukan broadcast
 * dengan actionUrl `/notifications` dulu tidak membuka apa pun).
 */
export function isNotificationInboxRoute(href: Href | null | undefined): boolean {
  if (!href) return false
  return hrefPathname(href) === hrefPathname(ROUTES.notifications)
}

/** FE-45: rute menunjuk detail notifikasi `id` itu sendiri (tautan ke diri sendiri). */
export function isNotificationSelfRoute(href: Href | null | undefined, id: string): boolean {
  if (!href || !id) return false
  if (typeof href === "string") return href.split("?", 1)[0] === `/notification/${id}`
  // `ROUTES.notificationDetail` = { pathname: "/notification/[id]", params: { id } }
  // — pathname-nya sama untuk SEMUA id, jadi params.id wajib dibandingkan.
  const h = href as { pathname?: unknown; params?: { id?: unknown } }
  return h.pathname === "/notification/[id]" && String(h.params?.id ?? "") === id
}

/**
 * T5-009 (audit UI/UX intuitif 2026-09-29): peta "layar induk logis" per rute.
 *
 * Fallback tombol kembali saat `router.canGoBack()` false — mis. aplikasi
 * dibuka dari tap notifikasi push dalam keadaan mati (cold start), sehingga
 * stack hanya berisi layar tujuan. Sebelumnya fallback selalu
 * `replace(ROUTES.home)` (tab Etalase): user membaca chat, menekan kembali,
 * malah terlempar ke beranda jualan. Kini kembali ke konteks asal:
 * ruang chat → /chat, detail pesanan → /transactions, detail karya →
 * /showcase, detail notifikasi → /notifications.
 *
 * Serumah dengan `routeForNotificationReference` karena keduanya memetakan
 * "rute dalam → konteks navigasi".
 */
export function logicalParentForPath(pathname: string): Href {
  const base = pathname.split("?")[0]?.split("#")[0] ?? "/"
  const head = base.split("/").filter(Boolean)[0]?.toLowerCase() ?? ""
  switch (head) {
    case "chat":
      return ROUTES.chat
    case "story":
      // 2026-10-08 (#17): tray story hidup di tab Pesan
      // (chat-tab-screen.tsx) — buka story dari sana, kembali ke sana.
      // Tanpa entri ini, cold-start dari tautan story mendarat di Etalase.
      return ROUTES.chat
    case "order":
    case "o":
      return ROUTES.transactions
    case "dispute":
      return ROUTES.disputes
    case "showcase":
      return ROUTES.showcase
    case "tracking":
    case "returns":
    case "products":
    case "milestones":
      // SYS-C-404: pelacakan/retur/produk/tahap adalah konteks transaksi —
      // kembali ke tab Transaksi, bukan tab Etalase.
      return ROUTES.transactions
    case "support":
      // SYS-C-404: tiket bantuan → daftar tiket bantuan.
      return ROUTES.support
    case "questions":
      // B3P-01: daftar pertanyaan milik sendiri; target push QUESTION.
      // Induk = tab Notifikasi (konteks asal push), BUKAN dirinya sendiri —
      // self-loop membuat tombol back header no-op saat cold-start.
      return ROUTES.notifications
    case "notifications":
    case "notification":
    case "badges":
      return ROUTES.notifications
    case "help":
    case "faq":
      // P1-B2: artikel/kategori bantuan → hub Pusat Bantuan.
      return ROUTES.faq
    case "invoice":
    case "delivery-proof":
    case "extension":
    case "rate":
      // P2-T6: konteks transaksi → tab Transaksi.
      return ROUTES.transactions
    case "wallet":
      return ROUTES.wallet
    case "wallet-transaction":
    case "transfer":
    case "topup":
    case "receive":
    case "withdraw":
    case "topup-history":
    case "withdraw-history":
    case "withdrawal-schedules":
    case "wallet-history":
      // B2-01 + TX2-P2a: keluarga dompet → Dompet (bukan Etalase).
      return ROUTES.wallet
    case "payment":
      // B2-03 + TX2-P2a: target deeplink DANA finish yang CTA-nya ke Transaksi.
      return ROUTES.transactions
    case "order-link":
      // B2-03: samakan dengan "o" → transaksi.
      return ROUTES.transactions
    case "disputes":
      // B2-03: daftar sengketa (sejajar dengan detail "dispute").
      return ROUTES.disputes
    case "transaction-templates":
    case "service-bookings":
    case "order-links":
      // B2-06: konteks transaksi.
      return ROUTES.transactions
    case "seller":
      // B2-SC-04 → Poin 1: konteks seller kini di Kelola Etalase
      // ("Produk & Stok Saya" + "Promo saya" pindah ke sana sebagai seksi).
      return ROUTES.showcaseManagement
    case "verify-email":
    case "login-required":
      // B2-02: head auth yang terlewat batch-1 → login.
      return ROUTES.login
    case "live-support":
    case "contact":
    case "feedback":
      // B2-05: konteks bantuan → Pusat Bantuan.
      return ROUTES.faq
    case "security":
      // Sidebar 2026-10-05: /settings DIHAPUS — Keamanan kini item sidebar
      // tingkat atas; induk cold-start = Etalase (bukan dirinya sendiri —
      // self-loop membuat tombol back header no-op).
      return ROUTES.home
    case "kyc":
      // Sidebar 2026-10-05: /settings DIHAPUS — verifikasi identitas
      // (konteks akun) induknya = hub Keamanan.
      return ROUTES.security
    case "ratings":
      // B3P-02: "Ulasan saya" — target push RATING_NEW tanpa entri di
      // Pengaturan; induk = tab Notifikasi (konteks asal push).
      return ROUTES.notifications
    case "reports":
      // B3P-02: "Laporan saya" — entrinya ada di hub Bantuan
      // (app/faq.tsx:73); induk = Pusat Bantuan.
      return ROUTES.faq
    case "user":
      // B3P-02: profil publik — target push follow; diakses dari mana-mana
      // (feed, chat, pencarian) tanpa satu induk fungsional; cold-start dari
      // push → induk = tab Notifikasi (konteks asal).
      return ROUTES.notifications
    case "deletion-status":
      // B3P-02: layar pra-login (tanpa sesi), dibuka dari layar Login
      // (app/(auth)/login.tsx:783) & push accountdeletion; induk = Login.
      return ROUTES.login
    case "notification-settings":
    case "notification-preferences":
    case "privacy-settings":
    case "blocked-users":
    case "delete-account":
    case "social-providers":
      // Sidebar 2026-10-05: /settings DIHAPUS — keluarga akun → Keamanan
      // (section Notifikasi + baris Privasi/Blokir/Hapus/Sosial di sana).
      return ROUTES.security
    case "addresses":
    case "bank-accounts":
    case "business-verification":
      // Sidebar 2026-10-05: kini item sidebar tingkat atas — induk = Etalase.
      return ROUTES.home
    case "terms":
    case "privacy-policy":
    case "about":
      // Sidebar 2026-10-05: legal pindah ke bawah Pusat Bantuan.
      return ROUTES.faq
    case "language":
    case "appearance":
    case "app-version":
      // Sidebar 2026-10-05: /language DIHAPUS (segmen kaki sidebar);
      // Tampilan & Versi tanpa hub — induk = Etalase.
      return ROUTES.home
    case "two-factor":
    case "passkeys":
    case "biometric-settings":
    case "security-activity":
    case "change-email":
    case "change-phone":
    case "change-password":
    case "change-pin":
      // B2-04: keluarga keamanan → Keamanan.
      return ROUTES.security
    case "forgot-password":
    case "login":
    case "register":
    case "verify-otp":
    case "verify-2fa":
    case "whatsapp-trigger":
    case "reset-password":
    case "register-security":
    case "phone-migration":
    case "social-link-confirm":
    case "onboarding":
      // P1-A1: head auth → login (bukan /showcase yang protected).
      return ROUTES.login
    default:
      return ROUTES.home
  }
}

/**
 * 2026-10-08 (temuan #17): induk tombol kembali yang DIJAMIN bukan
 * `pathname` itu sendiri.
 *
 * `logicalParentForPath` memetakan per SEGMEN PERTAMA, jadi layar hub
 * otomatis menjadi induknya sendiri — `/chat` → `/chat`, `/faq` → `/faq`,
 * `/wallet` → `/wallet`. Untuk pemanggil yang punya riwayat itu tidak apa-apa
 * (tombol back memang memanggil `router.back()`), tetapi pada cold start dari
 * deep link/push stack-nya kosong dan jalur fallback dipakai: `replace()` ke
 * diri sendiri adalah NO-OP. Tombol kembali terlihat, dipencet, dan tidak
 * terjadi apa-apa — "nyangkut".
 *
 * Helper ini mengembalikan `null` untuk kasus itu supaya pemanggil memilih
 * secara eksplisit (sembunyikan tombol, atau kembali ke beranda) alih-alih
 * diam-diam tidak melakukan apa-apa.
 */
export function backTargetForPath(pathname: string): string | null {
  const base = pathname.split("?")[0]?.split("#")[0] ?? "/"
  const parent = logicalParentForPath(base)
  const parentPath =
    typeof parent === "string"
      ? (parent.split(/[?#]/, 1)[0] ?? null)
      : parent && typeof parent === "object" && "pathname" in parent
        ? ((parent as { pathname?: string }).pathname ?? null)
        : null
  if (!parentPath) return null
  const normalized = parentPath.replace(/\/+$/, "") || "/"
  if (normalized === (base.replace(/\/+$/, "") || "/")) return null
  return normalized
}

/**
 * Label CTA layar detail ("Lihat pesanan", "Buka chat", …) untuk sebuah
 * referensi; `null` bila tidak dikenali (detail tetap tampil tanpa CTA).
 * Audit 2026-10-10 (FE-29): literal dibungkus `translate()` LANGSUNG — pemindai
 * katalog i18n tidak memungut `return "…"` polos, sehingga 20+ label ini
 * tidak pernah masuk katalog/kamus dan pengguna EN selalu melihat Indonesia.
 * Tabel sejajar dengan `routeForNotificationReference` di atas.
 * Bila `referenceType` kosong, label diturunkan dari `actionUrl`.
 */
export function labelForNotificationReference(ref: NotificationReference): string | null {
  const type = ref.referenceType ? normalizeType(ref.referenceType) : ""
  const id = ref.referenceId?.trim() ?? ""
  if (!type) return labelForActionUrl(ref.actionUrl)

  // NCC-003/NCC-004: keluarga DISPUTE_* / MILESTONE_* (push maupun inbox).
  if (type.startsWith("dispute")) return translate("Lihat sengketa")
  if (type.startsWith("milestone")) return translate("Lihat tahap")
  // FAL-018: balasan feedback kini membuka tiket bantuan (bukan formulir).
  if (type === "feedback") return translate("Lihat bantuan")
  // FAL-019: ORDER_SHIPPED → detail pelacakan.
  if (type === "ordershipped" || type === "ordership" || type === "shipment") return translate("Lihat pelacakan")

  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return translate("Lihat pesanan")
    case "orderlink":
      return translate("Buka tautan pesanan")
    case "dispute":
      return translate("Lihat sengketa")
    case "wallettransaction":
    case "wallettx":
    case "topup":
    case "withdraw":
    case "withdrawal":
    case "transfer":
      return translate("Lihat mutasi")
    case "wallet":
      return translate("Buka dompet")
    case "chat":
    case "chatroom":
    case "message":
    case "chatnew":
    case "chatnewmessage":
      return translate("Buka chat")
    case "supportticket":
    case "ticket":
    case "support":
    case "supportticketupdate":
      return translate("Lihat tiket bantuan")
    case "supportconversation":
    case "supportagentreply":
    case "supportchatreply":
      return translate("Buka chat bantuan")
    case "user":
    case "profile":
    case "follow":
    case "follower":
      return translate("Lihat profil")
    case "kyc":
    case "verification":
      return translate("Buka verifikasi")
    case "subscription":
      return translate("Lihat langganan")
    case "referral":
      return translate("Lihat referral")
    case "rating":
    case "review":
      return translate("Lihat ulasan")
    case "showcase":
    case "etalase":
    case "showcaselike":
    case "showcasecomment":
      return translate("Lihat karya")
    case "showcasereport":
      return translate("Lihat laporan saya")
    case "usershowcase":
      return translate("Lihat karya")
    case "reportappeal":
      return translate("Lihat hasil banding")
    case "accountdeletion":
      return translate("Lihat status penghapusan")
    case "ratingnew":
      return translate("Lihat ulasan")
    case "kycapproved":
      return translate("Buka verifikasi")
    case "security":
    case "session":
    case "login":
      return translate("Buka keamanan")
    case "questions":
    case "question":
      // FAL-020: sejajar dengan routeForNotificationReference.
      return translate("Lihat pertanyaan")
    case "returns":
    case "return":
      return translate("Lihat retur")
    case "products":
    case "product":
      // Poin 1: tujuan baru = Kelola Etalase (bukan detail produk).
      return translate("Kelola Etalase")
    case "servicebookings":
    case "servicebooking":
      // Poin 1: tujuan baru = segmen booking di tab Transaksi.
      return translate("Lihat booking")
    default:
      return labelForTypeFamily(type, id)
  }
}

/**
 * Label CTA dari `actionUrl` backend; `null` bila tidak dikenali.
 * Sejajar dengan `routeForActionUrl` di atas.
 */
export function labelForActionUrl(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null
  const path = actionUrl.startsWith("http") ? null : actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`
  if (!path) return null
  const segments = path.split("?", 1)[0].split("/").filter(Boolean)
  const head = segments[0]
  switch (head) {
    case "chat":
      return translate("Buka chat")
    case "order":
      return translate("Lihat pesanan")
    case "o":
    case "order-link":
    case "link":
      // Audit 2026-10-10 (FE-09/FE-10): `/o/<token>` = tautan order pendek
      // (app/o/[token].tsx), bukan detail order — sejajar routeForActionUrlRaw.
      return translate("Buka tautan pesanan")
    case "support":
      // Audit 2026-10-10 (FE-18/FE-28): `/support/chat/<id>` = livechat;
      // `/support/<id>` = tiket. Dulu tak ada cabang "support" sama sekali →
      // CTA detail tersembunyi walau rutenya ada.
      return segments[1] === "chat" ? "Buka chat bantuan" : "Lihat tiket bantuan"
    case "dispute":
      return translate("Lihat sengketa")
    case "showcase":
      return translate("Lihat karya")
    case "wallet":
      return translate("Lihat mutasi")
    case "questions":
      return translate("Lihat pertanyaan")
    case "returns":
      // FAL-016: `/returns/<id>` → detail retur.
      return translate("Lihat retur")
    case "products":
      // Poin 1: `/products/<id>` → Kelola Etalase (bukan detail produk).
      return translate("Kelola Etalase")
    case "service-bookings":
      // Poin 1: `/service-bookings` → segmen booking di tab Transaksi.
      return translate("Lihat booking")
    case "tracking":
      // FAL-019: `kahade://tracking/<id>` → detail pelacakan.
      return translate("Lihat pelacakan")
    case "milestones":
      // NCC-004: `/milestones/<id>` → detail tahap.
      return translate("Lihat tahap")
    case "feedback":
      // FAL-018: balasan feedback → tiket bantuan (lihat routeForActionUrlRaw).
      return translate("Lihat bantuan")
    case "bank-accounts":
      // NCC-008: `/bank-accounts` (ESCROW_HELD_NO_BANK) → daftar rekening.
      return translate("Daftarkan rekening")
    case "notifications":
    case "notification":
    case "badges":
      return translate("Lihat notifikasi")
    default:
      return null
  }
}

/**
 * Route dari `data` payload push. Prioritas:
 *   1. `actionUrl` backend (mis. `/chat/<id>`, `/order/<id>`, `/o/<id>`,
 *      `/wallet/transaction?id=<txId>`) — sumber paling akurat.
 *   2. `referenceType`/`referenceId`, atau pasangan `type` + salah satu
 *      `id | shipmentId | returnId | orderId | disputeId | roomId | ticketId | txId | username | token`.
 */
export function routeForPushData(data: unknown): Href | null {
  return applyWalletFallback(routeForPushDataRaw(data))
}

/** Pemetaan mentah payload push → route, tanpa fallback kill-switch dompet. */
function routeForPushDataRaw(data: unknown): Href | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined)

  // 1. actionUrl lebih dulu — payload backend selalu menyertakannya.
  const fromActionUrl = routeForActionUrl(str("actionUrl"))
  if (fromActionUrl) return fromActionUrl

  // 2. Fallback ke referenceType/referenceId atau type + id.
  // `notificationType` ikut dibaca: payload push backend selalu menyertakan
  // enum kanonisnya (mis. CHAT_NEW_MESSAGE) walau `type`-nya alias
  // (CHAT_NEW) — keduanya dinormalisasi ke alias tabel di atas.
  // BFI-116: backend memakai `refType`/`refId` (kolom notifikasi) — baca
  // varian itu juga sebelum jatuh ke kunci turunan.
  const referenceType =
    str("refType") ?? str("referenceType") ?? str("type") ?? str("notificationType") ?? str("kind")
  const referenceId =
    str("refId") ??
    str("referenceId") ??
    str("id") ??
    // FAL-019: push kurir membawa { orderId, shipmentId } — untuk
    // ORDER_SHIPPED yang dipakai adalah shipmentId (detail pelacakan),
    // jadi ia harus menang atas orderId bila keduanya ada.
    str("shipmentId") ??
    // FAL-016: push retur memakai id internal DB (`returnDbId`; terima juga
    // varian `returnId`).
    str("returnId") ??
    str("returnDbId") ??
    str("orderId") ??
    str("disputeId") ??
    str("milestoneId") ?? // NCC-004: data push milestone membawa milestoneId
    str("questionId") ?? // NCC-014: data push pertanyaan membawa questionId
    str("conversationId") ?? // Audit 2026-10-10 (FE-17): push livechat support
    str("roomId") ??
    str("chatRoomId") ??
    str("ticketId") ??
    str("txId") ??
    str("transactionId") ??
    str("username") ??
    str("token")
  // SH-F-008: id komentar untuk highlight deep-link; kunci payload tidak
  // didokumentasikan backend (gap kontrak) — terima varian yang lazim.
  const commentId = str("commentId") ?? str("comment_id") ?? str("comment")

  return routeForNotificationReference({ referenceType, referenceId, commentId })
}

/**
 * E1-001: `decodeURIComponent` MELEMPAR `URIError` untuk sekuens persen
 * malformed (mis. `%` mentah atau `%zz` di `actionUrl` payload push dari
 * backend yang rusak/berubah format). Tanpa guard, satu payload nakal
 * membunuh seluruh handler tap notifikasi tanpa feedback. Fallback ke
 * nilai mentah — rute tetap terbentuk dengan id apa adanya.
 */
function safeDecodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Parse `actionUrl` backend menjadi route internal.
 * Format yang dikenal: `/chat/<id>`, `/order/<id>`, `/o/<id>`,
 * `/dispute/<id>`, `/showcase/<id>`, `/support/tickets/<id>` (F15),
 * `/wallet/transaction?id=<txId>`, `/notifications`, `/badges`,
 * `/returns/<id>` (FAL-016), `/products/<id>` → Kelola Etalase (Poin 1),
 * `/service-bookings` → segmen booking tab Transaksi (Poin 1),
 * `kahade://tracking/<id>` (FAL-019, dinormalisasi ke `/tracking/<id>`),
 * `/feedback/<id>` → tiket bantuan (FAL-018, tanpa layar detail feedback).
 * Return `null` bila tidak dikenali.
 */
export function routeForActionUrl(actionUrl: string | null | undefined): Href | null {
  return applyWalletFallback(routeForActionUrlRaw(actionUrl))
}

/** Parse mentah `actionUrl` backend → route internal, tanpa fallback dompet. */
function routeForActionUrlRaw(actionUrl: string | null | undefined): Href | null {
  if (!actionUrl) return null
  // FAL-019: deep link skema aplikasi (`kahade://tracking/<id>?status=...`)
  // dinormalisasi ke path internal (`/tracking/<id>`). Tanpa ini, prefix "/"
  // menghasilkan segmen ["kahade:", "tracking", "<id>"] → head "kahade:" →
  // null dan tap notifikasi pengiriman mati.
  const withoutScheme = actionUrl.replace(/^kahade:\/*/i, "/")
  // Hanya path internal; abaikan URL absolut eksternal.
  const path = withoutScheme.startsWith("http")
    ? null
    : withoutScheme.startsWith("/")
      ? withoutScheme
      : `/${withoutScheme}`
  if (!path) return null

  const [pathname, query] = path.split("?", 2)
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length >= 2) {
    const [head, ...rest] = segments
    const id = safeDecodeSegment(rest.join("/"))
    // Query diparse di sini juga: bentuk `/wallet/transaction?id=<txId>`
    // (payload push backend) punya DUA segmen, bukan satu.
    const params = new URLSearchParams(query ?? "")
    switch (head) {
      case "chat":
        return ROUTES.chatRoom(id)
      case "order":
        return ROUTES.orderDetail(id)
      case "o":
      case "order-link":
      case "link":
        // Audit 2026-10-10 (FE-09/FE-10): `/o/<token>` adalah tautan order
        // PENDEK (app/o/[token].tsx → /order-link/[token]), bukan detail
        // order — dulu dipetakan ke orderDetail(token) → layar 404.
        // `/order-link/<token>` (push-action-url backend) dan `/link/<token>`
        // (format processor lama) dulu tak dikenal → null.
        return ROUTES.orderLink(id)
      case "dispute":
        return ROUTES.disputeDetail(id)
      case "notification":
        // Audit 2026-10-10 (FE-45): deep link `kahade.id/notification/<id>`
        // (tautan email/push lama, lihat app/notification/[id].tsx) — dulu
        // tak dikenal → null.
        return ROUTES.notificationDetail(id)
      case "support": {
        // Audit 2026-10-10 (FE-08): `/support/chat/<conversationId>`
        // (SUPPORT_AGENT_REPLY) → livechat, BUKAN detail tiket.
        if (rest[0] === "chat") return ROUTES.supportChat
        // F15: `/support/tickets/<id>` atau `/support/<id>` (actionUrl push
        // status tiket) → detail tiket; `/support` → daftar tiket.
        const tail = rest[rest.length - 1]
        return tail ? ROUTES.supportTicket(tail) : ROUTES.support
      }
      case "showcase":
        return ROUTES.showcaseDetail(id)
      case "wallet": {
        // /wallet/transaction?id=<txId> → detail mutasi; /wallet/<lainnya> → dompet.
        const txId = params.get("id")
        return txId ? ROUTES.walletTransaction(txId) : ROUTES.wallet
      }
      case "questions":
        // NCC-014: Discovery Q&A — layar daftar pertanyaan.
        return ROUTES.questions
      case "milestones":
        // NCC-004: `/milestones/<id>` (actionUrl notifikasi milestone) → detail milestone.
        return ROUTES.milestoneDetail(id)
      case "returns":
        // FAL-016: `/returns/<id>` (actionUrl notifikasi retur — uang!) →
        // detail retur. Tanpa ini tap notifikasi retur mati (jatuh ke tab).
        return ROUTES.returnDetail(id)
      case "products":
        // FAL-017 → Poin 1: katalog dihapus dari navigasi; `/products/<id>`
        // kini mendarat di Kelola Etalase (rumah baru "Produk & Stok Saya").
        return ROUTES.showcaseManagement
      case "service-bookings":
        // Unified v2: booking jasa = kategori JASA di tab Transaksi.
        return ROUTES.transactionsFiltered({ category: "JASA" })
      case "tracking":
        // FAL-019: `/tracking/<id>` (dari `kahade://tracking/<id>`) →
        // detail pelacakan kiriman.
        return ROUTES.trackingDetail(id)
      case "feedback":
        // FAL-018: `/feedback/<id>` = balasan admin atas masukan user, tapi
        // backend TIDAK punya endpoint user-facing GET /v1/feedback/:id dan
        // app/feedback.tsx hanya formulir kirim (bukan layar detail) — tidak
        // ada file layar detail yang bisa dituju. Sementara itu, arahkan ke
        // tiket bantuan (jalur dukungan terdekat); jangan kirim actionUrl
        // tanpa tujuan. Keputusan ideal: backend sediakan GET
        // /v1/feedback/:id + layar detail balasan.
        return ROUTES.support
      default:
        break
    }
  }

  if (segments.length === 1) {
    switch (segments[0]) {
      case "notifications": {
        // BFI-121: actionUrl push `/notifications?notificationId=<notifId>`
        // (push.service `deriveActionUrl`) — buka & tandai notifikasi
        // SPESIFIK lewat layar detail (dibuka = dibaca, idempoten), bukan
        // sekadar tab inbox. Tanpa query → tab inbox seperti sebelumnya.
        const notificationId = new URLSearchParams(query ?? "").get("notificationId")
        return notificationId ? ROUTES.notificationDetail(notificationId) : ROUTES.notifications
      }
      case "bank-accounts":
        // NCC-008: `/bank-accounts` (actionUrl ESCROW_HELD_NO_BANK) → daftar rekening.
        return ROUTES.bankAccounts
      case "feedback":
        // FAL-018: lihat komentar di cabang dua-segmen — balasan feedback
        // tanpa layar detail → tiket bantuan.
        return ROUTES.support
      case "questions":
        // NCC-014: `/questions` → daftar pertanyaan.
        return ROUTES.questions
      case "wallet": {
        // Bentuk satu-segmen ber-query (`/wallet?id=<txId>`) — robustness.
        const txId = new URLSearchParams(query ?? "").get("id")
        return txId ? ROUTES.walletTransaction(txId) : ROUTES.wallet
      }
      case "badges":
        return ROUTES.notifications
      case "support":
        return ROUTES.support
      case "returns":
        // Poin 1: entri daftar "Retur Saya" dihapus dari drawer — `/returns`
        // polos kini ke tab Transaksi (retur diakses per-order).
        return ROUTES.transactions
      case "products":
        // Poin 1: katalog dihapus dari navigasi — `/products` polos ke
        // Kelola Etalase (rumah baru "Produk & Stok Saya").
        return ROUTES.showcaseManagement
      case "service-bookings":
        // Unified v2: booking jasa = kategori JASA di tab Transaksi.
        return ROUTES.transactionsFiltered({ category: "JASA" })
      default:
        break
    }
  }

  return null
}
