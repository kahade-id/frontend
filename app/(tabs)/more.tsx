/**
 * Screen — Halaman Lainnya (revisi 2026-09-26, permintaan produk).
 *
 * Sebelumnya halaman ini TERBACA SEBAGAI HALAMAN PENGATURAN: enam kategori
 * menu berisi 20+ baris berikon, dan separuh isinya duplikat persis dari
 * /settings (Keamanan, KYC, Notifikasi, Tampilan, Bahasa, Pusat Bantuan,
 * Live Support, Umpan Balik, Syarat & Ketentuan…). Satu halaman, dua pintu
 * ke tempat yang sama.
 *
 * Kini ia menjadi PAPAN AKSES CEPAT:
 *
 *      [ kartu profil saya ]        → tetap (sudah bagus)
 *      [ kartu mode aplikasi ]      → tetap (sudah bagus)
 *      Transaksi   ● ● ● ●          → lingkaran ABU-ABU + judul di bawah
 *      Etalase     ● ●
 *      Uang        ● ● ●
 *      Alat        ● ●
 *      ⋮ (kanan atas)               → Pengaturan (bukan pemindai)
 *
 * Keputusan:
 *   - Lingkaran dikELOMPOKKAN PER KATEGORI dengan label kecil (bukan satu
 *     datar tanpa judul): sepuluh ikon tanpa pembagian tidak terbaca lebih
 *     baik daripada daftar panjang yang diganti.
 *   - Latar lingkaran = `bg-surface-raised` TANPA border (bukan IconBox
 *     "surface" yang berbingkai): warna abu-abunya yang jadi wadah, ikonnya
 *     yang dibaca.
 *   - Yang tersisa di sini hanyalah jalan pintas ke halaman yang TIDAK ada
 *     di Pengaturan. Entri yang sudah hidup di /settings dibuang dari sini,
 *     bukan diduplikat. Order Link/Template/Sengketa tetap MASUK: yang
 *     dihapus permintaan #4 adalah ikon-ikon di header transaksi, bukan
 *     halamannya.
 *   - Ikon titik-tiga di kanan atas menggantikan ikon pemindai: pemindai
 *     sudah menempel permanen di navbar bawah mode dompet, sedangkan
 *     Pengaturan sebelumnya cuma bisa dicapai dengan menggulir ke baris
 *     terbawah halaman ini.
 *   - `marginBottom` setinggi navbar DIHAPUS dari ScrollView (bug "gap putih
 *     di atas navbar"): navbar kini dirender di root layout sebagai SAUDARA
 *     di bawah <Stack>, jadi ruangnya sudah di luar layar ini — margin itu
 *     malah menyisakan bidang kosong tepat di atas navbar.
 */
import { useCallback } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import {
  ArrowRight,
  Bank,
  CaretRight,
  DotsThree,
  FileText,
  Gift,
  Handshake,
  Link,
  PencilSimpleLine,
  Plus,
  Receipt,
  Scales,
  Scan,
  Ticket,
  User,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import { useAuthSession } from "@/lib/use-auth-session"
import { useAppMode } from "@/lib/app-mode"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n/translate"
import { useApiQuery } from "@/lib/use-api-query"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { Header, useDocumentTitle } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ModeSwitcher } from "@/components/ui/mode-switcher"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

type QuickAction = {
  id: string
  label: string
  icon: IconComponent
  onPress: () => void
}

/** Satu kategori akses cepat: label kecil + deretan lingkaran. */
type QuickGroup = {
  id: string
  label: string
  items: QuickAction[]
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

  const handleOpenProfile = useCallback(() => {
    if (!token || !profile?.username) {
      router.push(ROUTES.loginRequired("/more"))
      return
    }
    router.push(ROUTES.userProfile(profile.username))
  }, [profile?.username, router, token])

  /*
    Akses cepat DIKELOMPOKKAN PER KATEGORI (revisi 2026-09-26): setiap entri
    berupa lingkaran abu-abu berisi ikon dengan judul tepat di bawahnya,
    bukan baris daftar ber-deskripsi seperti Pengaturan. Yang masuk ke sini
    hanyalah halaman yang TIDAK punya pintu di Pengaturan — Order Link,
    Template, dan Sengketa tetap ada di sini karena yang dihapus (item 4)
    adalah IKON di header transaksi, bukan halamannya.
  */
  const groups: QuickGroup[] = [
    {
      id: "transaksi",
      label: "Transaksi",
      items: [
        {
          id: "create-transaction",
          label: "Buat Pesanan",
          icon: Handshake,
          onPress: () => router.push(ROUTES.createTransaction),
        },
        {
          id: "order-links",
          label: "Order Link",
          icon: Link,
          onPress: () => router.push(ROUTES.orderLinks),
        },
        {
          id: "templates",
          label: "Template",
          icon: FileText,
          onPress: () => router.push(ROUTES.transactionTemplates),
        },
        {
          id: "disputes",
          label: "Sengketa",
          icon: Scales,
          onPress: () => router.push(ROUTES.disputes),
        },
      ],
    },
    {
      id: "etalase",
      label: "Etalase",
      items: [
        {
          id: "showcase-create",
          label: "Buat Karya",
          icon: Plus,
          onPress: () => router.push(ROUTES.showcaseCreate),
        },
        {
          id: "showcase-management",
          label: "Kelola Etalase",
          icon: PencilSimpleLine,
          onPress: () => router.push(ROUTES.showcaseManagement),
        },
      ],
    },
    {
      id: "uang",
      label: "Uang",
      items: [
        {
          id: "vouchers",
          label: "Voucher",
          icon: Ticket,
          onPress: () => router.push(ROUTES.vouchers),
        },
        {
          id: "bank-accounts",
          label: "Rekening",
          icon: Bank,
          onPress: () => router.push(ROUTES.bankAccounts),
        },
        {
          id: "transactions",
          label: "Riwayat Order",
          icon: Receipt,
          onPress: () => router.push(ROUTES.transactions),
        },
      ],
    },
    {
      id: "alat",
      label: "Alat",
      items: [
        {
          id: "scan",
          label: "Pindai QR",
          icon: Scan,
          onPress: () => router.push(ROUTES.scan),
        },
        {
          id: "referral",
          label: "Undang Teman",
          icon: Gift,
          onPress: () => router.push(ROUTES.referral),
        },
      ],
    },
  ]

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={false}
        title="Lainnya"
        right={
          /*
           * Titik tiga = PENGATURAN (permintaan produk 2026-09-26). Ikon
           * pemindai yang lama diganti: pemindai sudah menjadi tombol tengah
           * navbar di mode dompet, sedangkan Pengaturan tidak punya pintu
           * dari header mana pun.
           */
          <IconButton
            icon={DotsThree}
            variant="ghost"
            accessibilityLabel="Pengaturan"
            accessibilityHint="Buka halaman pengaturan"
            onPress={() => router.push(ROUTES.settings)}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pt-3 gap-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
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
                    {isKycVerified ? <Badge tone="success">KYC</Badge> : null}
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
            <Button variant="primary" onPress={() => router.push(ROUTES.loginRequired("/more"))}>
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

        {/* ── LINGKARAN AKSES CEPAT, Dikelompokkan per kategori ── */}
        <View className="gap-5">
          <Text variant="h3" weight={600} className="px-1">
            Akses cepat
          </Text>
          {groups.map((group) => (
            <View key={group.id} className="gap-3">
              <Text variant="caption" tone="secondary" weight={600} className="px-1">
                {group.label}
              </Text>
              <View className="flex-row flex-wrap">
                {group.items.map((action) => (
                  // Lebar 1/4 = 4 lingkaran per baris (360dp terkecil);
                  // baris terakhir rata kiri, tidak ditarik melebar.
                  <View key={action.id} className="w-1/4 items-center pb-4">
                    <QuickActionButton action={action} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* ── CATATAN KAKI APLIKASI ── */}
        <View className="items-center justify-center py-2 gap-1">
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

/**
 * Satu lingkaran akses cepat: LINGKARAN ABU-ABU 56px + judul 12px di bawahnya
 * (permintaan produk 2026-09-26).
 *
 * Kenapa latar `bg-surface-raised` dan bukan <IconBox variant="surface">:
 * varian itu menggambar BORDER, sehingga delapan lingkaran berderet tampak
 * sebagai delapan kancing berbingkai. Tanpa border, warna abu-abunya yang
 * membentuk wadah — ikonnya yang dibaca, bukan kotaknya.
 *
 * Judul dibatasi dua baris dan dipusat, sehingga "Kelola Etalase" yang
 * terbungkus tetap sejajar dengan lingkaran tetangganya.
 */
function QuickActionButton({ action }: { action: QuickAction }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={action.label}
      haptic
      onPress={action.onPress}
      containerClassName="items-center rounded-md"
      className="items-center gap-2 px-1 py-1"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-raised">
        <Icon icon={action.icon} size="md" tone="default" />
      </View>
      <Text variant="caption" tone="primary" numberOfLines={2} className="text-center">
        {action.label}
      </Text>
    </PressableScale>
  )
}
