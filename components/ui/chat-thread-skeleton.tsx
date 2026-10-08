/**
 * Kahade — <ChatThreadSkeleton> shimmer berbentuk percakapan (audit chat I23).
 *
 * Dipakai di dua tempat:
 *   1. sebagai tampilan MEMUAT saat ruang baru dibuka (menggantikan tiga
 *      kartu `ListLoading` yang bentuknya tidak mirip chat);
 *   2. sebagai penutup selama thread menempatkan posisi ke pesan terbaru
 *      (lib/use-thread-positioning) — pengguna tidak melihat pesan tertua
 *      sesaat atau area kosong di ujung bawah.
 *
 * Gelembung bergantian kiri/kanan dengan lebar & tinggi bervariasi, ditempel
 * ke DASAR (seperti chat sungguhan: pesan terbaru di bawah). Memakai
 * <SkeletonGroup> sehingga semua blok berdenyut serempak dan pembaca layar
 * hanya mendengar satu "Memuat". Warna blok `contrast` (bg-border): di light
 * mode blok `subtle` nyaris tak terlihat dan layar tampak putih polos (Bug 2).
 */
import { View } from "react-native"

import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

type Bubble = { mine: boolean; width: string; height: string }

/** Kelas statis (bukan hasil interpolasi) agar terbaca generator Tailwind. */
const BUBBLES: readonly Bubble[] = [
  { mine: false, width: "w-3/5", height: "h-12" },
  { mine: false, width: "w-2/5", height: "h-8" },
  { mine: true, width: "w-1/2", height: "h-12" },
  { mine: false, width: "w-4/5", height: "h-16" },
  { mine: true, width: "w-2/5", height: "h-8" },
  { mine: true, width: "w-3/5", height: "h-14" },
  { mine: false, width: "w-1/2", height: "h-12" },
  { mine: true, width: "w-1/3", height: "h-8" },
]

export function ChatThreadSkeleton() {
  return (
    <View testID="chat-thread-skeleton" className="flex-1 justify-end overflow-hidden">
      <SkeletonGroup className="gap-3 px-5 pb-4">
        {BUBBLES.map((bubble, index) => (
          <View key={index} className={bubble.mine ? "items-end" : "items-start"}>
            {/* Lebar di pembungkus (persen terhadap baris penuh); blok `w-full`
                di dalamnya — persen terhadap induk berukuran-isi akan nol. */}
            <View className={bubble.width}>
              <Skeleton shape="card" tone="contrast" className={`w-full ${bubble.height}`} />
            </View>
          </View>
        ))}
      </SkeletonGroup>
    </View>
  )
}
