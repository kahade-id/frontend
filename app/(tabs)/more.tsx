/**
 * Screen — Halaman Lainnya (More / Menu Pusat Layanan).
 *
 * Menggantikan tab Profil di bottom navigation bar:
 *  - Profil kini memiliki alur tampilan yang sama seperti profil pengguna lain
 *    (halaman stack dengan tombol Back dan tanpa bottom navbar).
 *  - Halaman Lainnya menjadi pusat kendali layanan terstruktur per kategori:
 *    1. Transaksi & Escrow (Order Link, Template Transaksi, Sengketa, Transaksi Berjalan, Riwayat)
 *    2. Promo & Rewards (Voucher, Kode Promo, Ajak Teman / Referral, Leaderboard, Badges)
 *    3. Etalase & Kreator (Kelola Etalase, Tersimpan, Favorit, Tanya Jawab, Ulasan)
 *    4. Keuangan & Rekening (Rekening Bank, Jadwal Penarikan, Top Up & Tarik, Mutasi Dompet, Pindai QR)
 *    5. Akun, Keamanan & Pengaturan (Keamanan, KYC, Verifikasi Bisnis, Notifikasi, Pengaturan)
 *    6. Bantuan & Dukungan (Pusat Bantuan, Live Support, Feedback, Syarat & Ketentuan)
 *  - Menyediakan kartu profil ringkas pengguna untuk navigasi ke profil lengkap.
 *  - Menyediakan pengalih mode aplikasi (E-Commerce ⇄ E-Wallet) yang tetap ada dan intuitif.
 */
import { useCallback } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowRight,
  Bank,
  Bell,
  BookmarkSimple,
  Briefcase,
  CalendarCheck,
  CaretRight,
  ChatCircleDots,
  ClockCounterClockwise,
  FileText,
  GearSix,
  Gift,
  Headset,
  Heart,
  IdentificationCard,
  Link,
  PencilSimpleLine,
  Question,
  Scales,
  Scan,
  SealCheck,
  ShieldCheck,
  ShoppingBag,
  Star,
  Ticket,
  Trophy,
  User,
  Wallet,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import { useAuthSession } from "@/lib/use-auth-session"
import { useAppMode } from "@/lib/app-mode"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n/translate"
import { useApiQuery } from "@/lib/use-api-query"
import { TAB_BAR_HEIGHT } from "@/components/ui/bottom-tab-bar"

import { Avatar } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { Header, useDocumentTitle } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ModeSwitcher } from "@/components/ui/mode-switcher"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"

type MenuItem = {
  id: string
  label: string
  description?: string
  icon: IconComponent
  badge?: string | number
  badgeTone?: BadgeTone
  onPress: () => void
}

type MenuCategory = {
  id: string
  title: string
  description?: string
  items: MenuItem[]
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const mode = useAppMode()
  const { token } = useAuthSession()
  useDocumentTitle(translate("Lainnya"))

  // Ambil profil akun sendiri
  const profileQuery = useApiQuery(
    "more:profile",
    (signal) => api.users.getMeCached(signal),
    Boolean(token),
  )
  const profile: UserProfile | null = profileQuery.data ?? null

  const isKycVerified = Boolean((profile as unknown as { isKycVerified?: boolean })?.isKycVerified)

  // Ambil ringkasan / transaksi aktif
  const ordersSummaryQuery = useApiQuery(
    "more:orders-active",
    (signal) => api.orders.listOrders({ status: "ACTIVE", limit: 1 }, signal),
    Boolean(token),
  )
  const activeOrdersCount = ordersSummaryQuery.data?.meta?.total ?? ordersSummaryQuery.data?.data?.length ?? 0

  const categories: MenuCategory[] = [
    {
      id: "transactions",
      title: "Transaksi & Escrow",
      description: "Kelola pesanan, bukti, dan penyelesaian masalah transaksi",
      items: [
        {
          id: "active-orders",
          label: "Transaksi Berjalan",
          description: "Pesanan aktif yang sedang diproses escrow",
          icon: ShoppingBag,
          badge: activeOrdersCount > 0 ? `${activeOrdersCount} aktif` : undefined,
          badgeTone: "info",
          onPress: () => router.push(ROUTES.transactions),
        },
        {
          id: "order-links",
          label: "Order Link",
          description: "Tautan pembayaran instan untuk transaksi praktis",
          icon: Link,
          onPress: () => router.push(ROUTES.orderLinks),
        },
        {
          id: "templates",
          label: "Template Transaksi",
          description: "Format transaksi siap pakai untuk transaksi rutin",
          icon: FileText,
          onPress: () => router.push(ROUTES.transactionTemplates),
        },
        {
          id: "disputes",
          label: "Sengketa & Mediasi",
          description: "Penyelesaian kendala transaksi dengan tim penengah",
          icon: Scales,
          onPress: () => router.push(ROUTES.disputes),
        },
        {
          id: "order-history",
          label: "Riwayat Transaksi",
          description: "Semua catatan transaksi selesai dan dibatalkan",
          icon: ClockCounterClockwise,
          onPress: () => router.push(ROUTES.transactions),
        },
      ],
    },
    {
      id: "promos",
      title: "Promo, Event & Hadiah",
      description: "Keuntungan biaya, voucher diskon, dan apresiasi akun",
      items: [
        {
          id: "vouchers",
          label: "Voucher & Kode Promo",
          description: "Kupon potongan biaya transaksi escrow",
          icon: Ticket,
          onPress: () => router.push(ROUTES.vouchers),
        },
        {
          id: "referral",
          label: "Ajak Teman & Event",
          description: "Undang teman dan dapatkan komisi saldo",
          icon: Gift,
          badge: "Bonus",
          badgeTone: "success",
          onPress: () => router.push(ROUTES.referral),
        },
        {
          id: "trust-score",
          label: "Skor Kepercayaan & Reputasi",
          description: "Tingkat kepercayaan akun dan rekam jejak",
          icon: Trophy,
          onPress: () => router.push(ROUTES.trustScore),
        },
        {
          id: "badges",
          label: "Lencana Penghargaan",
          description: "Pencapaian transaksi dan lencana verifikasi",
          icon: SealCheck,
          onPress: () => router.push(ROUTES.badges),
        },
      ],
    },
    {
      id: "showcase",
      title: "Etalase & Jualan",
      description: "Tampilkan karya, produk, dan interaksi dengan peminat",
      items: [
        {
          id: "showcase-management",
          label: "Kelola Etalase",
          description: "Tambah, edit, dan pantau status etalase Anda",
          icon: PencilSimpleLine,
          onPress: () => router.push(ROUTES.showcaseManagement),
        },
        {
          id: "saved",
          label: "Item Tersimpan",
          description: "Koleksi etalase yang Anda bookmark untuk nanti",
          icon: BookmarkSimple,
          onPress: () => router.push(ROUTES.saved),
        },
        {
          id: "favorites",
          label: "Karya Disukai",
          description: "Daftar postingan etalase yang Anda beri apresiasi",
          icon: Heart,
          onPress: () => router.push(ROUTES.favorites),
        },
        {
          id: "questions",
          label: "Tanya Jawab & Utas",
          description: "Pertanyaan seputar produk dan etalase Anda",
          icon: ChatCircleDots,
          onPress: () => router.push(ROUTES.questions),
        },
        {
          id: "ratings",
          label: "Ulasan & Penilaian",
          description: "Ulasan dari pihak yang telah bertransaksi dengan Anda",
          icon: Star,
          onPress: () => router.push(ROUTES.ratings),
        },
      ],
    },
    {
      id: "finance",
      title: "Keuangan & Rekening Bank",
      description: "Pengaturan rekening tujuan, pencairan, dan riwayat mutasi",
      items: [
        {
          id: "bank-accounts",
          label: "Rekening Bank & E-Wallet",
          description: "Daftar rekening bank terverifikasi untuk penarikan",
          icon: Bank,
          onPress: () => router.push(ROUTES.bankAccounts),
        },
        {
          id: "withdrawal-schedules",
          label: "Jadwal Penarikan Otomatis",
          description: "Atur penarikan saldo berkala secara terjadwal",
          icon: CalendarCheck,
          onPress: () => router.push(ROUTES.withdrawalSchedules),
        },
        {
          id: "topup-history",
          label: "Riwayat Top Up",
          description: "Catatan riwayat isi saldo dompet Kahade",
          icon: ArrowCircleDown,
          onPress: () => router.push(ROUTES.topupHistory),
        },
        {
          id: "withdraw-history",
          label: "Riwayat Penarikan Dana",
          description: "Status pencairan dana ke rekening bank",
          icon: ArrowCircleUp,
          onPress: () => router.push(ROUTES.withdrawHistory),
        },
        {
          id: "wallet-history",
          label: "Riwayat Mutasi Dompet",
          description: "Rincian menyeluruh semua arus saldo masuk dan keluar",
          icon: Wallet,
          onPress: () => router.push(ROUTES.walletHistory),
        },
        {
          id: "scan",
          label: "Pindai QR / Bayar",
          description: "Scan QRIS, QR Kahade terima saldo, atau tautan",
          icon: Scan,
          onPress: () => router.push(ROUTES.scan),
        },
      ],
    },
    {
      id: "account",
      title: "Akun, Keamanan & Pengaturan",
      description: "Proteksi identitas, data diri, dan preferensi aplikasi",
      items: [
        {
          id: "security",
          label: "Keamanan Akun",
          description: "PIN transaksi, kata sandi, 2FA, dan biometrik",
          icon: ShieldCheck,
          onPress: () => router.push(ROUTES.security),
        },
        {
          id: "kyc",
          label: "Verifikasi Identitas (KYC)",
          description: "Verifikasi kartu identitas untuk limit transaksi maksimal",
          icon: IdentificationCard,
          badge: isKycVerified ? "Terverifikasi" : "Belum",
          badgeTone: isKycVerified ? "success" : "neutral",
          onPress: () => router.push(ROUTES.kyc),
        },
        {
          id: "business-verification",
          label: "Verifikasi Bisnis",
          description: "Identitas entitas usaha dan profil toko terpercaya",
          icon: Briefcase,
          onPress: () => router.push(ROUTES.businessVerification),
        },
        {
          id: "notifications-pref",
          label: "Preferensi Notifikasi",
          description: "Pengaturan pemberitahuan pesan dan transaksi",
          icon: Bell,
          onPress: () => router.push(ROUTES.notificationPreferences),
        },
        {
          id: "settings",
          label: "Pengaturan & Tampilan",
          description: "Bahasa, tema aplikasi, dan preferensi akun",
          icon: GearSix,
          onPress: () => router.push(ROUTES.settings),
        },
      ],
    },
    {
      id: "support",
      title: "Bantuan & Layanan",
      description: "Pusat bantuan pelanggan dan informasi resmi Kahade",
      items: [
        {
          id: "help-center",
          label: "Pusat Bantuan & FAQ",
          description: "Jawaban pertanyaan umum dan panduan bertransaksi",
          icon: Question,
          onPress: () => router.push(ROUTES.support),
        },
        {
          id: "live-support",
          label: "Live Support 24/7",
          description: "Hubungi tim bantuan resmi Kahade via percakapan langsung",
          icon: Headset,
          badge: "Online",
          badgeTone: "success",
          onPress: () => router.push(ROUTES.liveSupport),
        },
        {
          id: "feedback",
          label: "Hubungi Kami & Saran",
          description: "Kirim masukan atau laporkan kendala operasional",
          icon: ChatCircleDots,
          onPress: () => router.push(ROUTES.feedback),
        },
      ],
    },
  ]

  const handleOpenProfile = useCallback(() => {
    if (!token || !profile?.username) {
      router.push(ROUTES.loginRequired("/more"))
      return
    }
    router.push(ROUTES.userProfile(profile.username))
  }, [profile?.username, router, token])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={false}
        title="Lainnya"
        right={
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Pindai QR"
            accessibilityHint="Buka pemindai kode QR"
            haptic
            onPress={() => router.push(ROUTES.scan)}
            containerClassName="rounded-md"
            className="h-10 w-10 items-center justify-center"
          >
            <Icon icon={Scan} size="md" tone="active" />
          </PressableScale>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pt-3 pb-8 gap-5"
        style={{ marginBottom: insets.bottom + TAB_BAR_HEIGHT }}
      >
        {/* ── KARTU PROFIL RINGKAS ── */}
        {token && profile ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Lihat profil saya, @{x}", { x: profile.username ?? "" })}
            accessibilityHint="Buka halaman profil lengkap"
            onPress={handleOpenProfile}
            containerClassName="w-full rounded-md"
            className="w-full"
          >
            <Card variant="elevated" className="p-4 gap-3">
              <View className="flex-row items-center gap-3">
                <Avatar
                  source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
                  name={profile.fullName || profile.username || "Pengguna"}
                  size="lg"
                  verified={isKycVerified}
                />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text variant="bodyLarge" weight={600} numberOfLines={1}>
                      {profile.fullName || profile.username}
                    </Text>
                    {isKycVerified ? (
                      <Badge tone="success">KYC</Badge>
                    ) : null}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    @{profile.username}
                  </Text>
                </View>
                <View className="h-8 w-8 items-center justify-center rounded-full bg-surface">
                  <Icon icon={CaretRight} size="sm" tone="default" />
                </View>
              </View>

              <Divider />

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Icon icon={User} size="xs" tone="default" />
                  <Text variant="caption" tone="secondary">
                    Tampilan profil publik Anda
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text variant="caption" weight={600} tone="primary">
                    Buka Profil
                  </Text>
                  <Icon icon={ArrowRight} size="xs" tone="active" />
                </View>
              </View>
            </Card>
          </PressableScale>
        ) : (
          <Card variant="elevated" className="p-4 gap-3">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={User} size="md" tone="default" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="bodyLarge" weight={600}>
                  Masuk ke Akun Anda
                </Text>
                <Text variant="caption" tone="secondary">
                  Akses transaksi, etalase, dompet, dan penarikan dana
                </Text>
              </View>
            </View>
            <Button
              variant="primary"
              onPress={() => router.push(ROUTES.loginRequired("/more"))}
            >
              Masuk atau Daftar
            </Button>
          </Card>
        )}

        {/* ── KARTU PENGALIH MODE APLIKASI (E-Commerce ⇄ E-Wallet) ── */}
        <Card variant="elevated" className="p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="gap-0.5 flex-1 pr-2">
              <Text variant="label" tone="primary">
                Mode Aplikasi
              </Text>
              <Text variant="caption" tone="secondary">
                {mode === "commerce"
                  ? "Mode Etalase aktif: navigasi fokus pada produk, order & percakapan."
                  : "Mode Dompet aktif: navigasi fokus pada saldo, promo & mutasi kas."}
              </Text>
            </View>
            <ModeSwitcher />
          </View>
        </Card>

        {/* ── KATEGORI MENU ── */}
        {categories.map((category) => (
          <View key={category.id} className="gap-2">
            <View className="px-1 gap-0.5">
              <Text variant="h3" weight={600}>
                {category.title}
              </Text>
              {category.description ? (
                <Text variant="caption" tone="secondary">
                  {category.description}
                </Text>
              ) : null}
            </View>

            <Card variant="elevated" className="overflow-hidden p-0">
              {category.items.map((item, index) => {
                const isLast = index === category.items.length - 1
                return (
                  <View key={item.id}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityHint={item.description}
                      onPress={item.onPress}
                      containerClassName="w-full"
                      className="w-full flex-row items-center gap-3 px-4 py-3.5"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface">
                        <Icon icon={item.icon} size="md" tone="active" />
                      </View>

                      <View className="flex-1 min-w-0 gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <Text variant="body" weight={600} numberOfLines={1} className="flex-1">
                            {item.label}
                          </Text>
                          {item.badge ? (
                            <Badge tone={item.badgeTone ?? "neutral"}>
                              {String(item.badge)}
                            </Badge>
                          ) : null}
                        </View>
                        {item.description ? (
                          <Text variant="caption" tone="secondary" numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>

                      <Icon icon={CaretRight} size="sm" tone="default" />
                    </PressableScale>
                    {!isLast ? <Divider className="ml-16" /> : null}
                  </View>
                )
              })}
            </Card>
          </View>
        ))}

        {/* ── CATATAN KAKI APLIKASI ── */}
        <View className="items-center justify-center py-4 gap-1">
          <Text variant="caption" tone="secondary">
            Kahade Safe Escrow & Commerce · Versi 1.0.0
          </Text>
          <Text variant="caption" tone="secondary" className="text-2xs text-center">
            Transaksi aman, terjaga, dan terpercaya di seluruh Indonesia
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}
