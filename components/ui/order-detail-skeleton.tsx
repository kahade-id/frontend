/**
 * Kahade — <OrderDetailSkeleton>.
 *
 * Kerangka loading halaman detail order — meniru susunan layar BARU
 * (iterasi de-card 2026-09-27): pita hero full-bleed, rel journey tanpa
 * kartu, dan baris-baris polos dengan hairline divider. Tanpa kartu
 * mengambang agar tidak ada lompatan layout saat data masuk.
 */
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonText } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

function SkeletonSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={cn("gap-3", className)}>
      <Skeleton height={20} className="w-2/5" />
      {children}
    </View>
  )
}

export function OrderDetailSkeleton(props: ViewProps) {
  return (
    <Screen edges={["top"]} padded={false} {...props}>
      <Header title={translate("Detail Order")} />
      <View
        className="gap-7 px-5"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={translate("Memuat detail order")}
      >
        {/* Hero — pita full-bleed */}
        <View className="-mx-5 -mt-3 bg-surface px-5 pb-7 pt-6">
          <View className="gap-3">
            <Skeleton height={14} className="w-1/3" />
            <Skeleton height={30} className="w-3/5" />
            <Skeleton height={20} className="w-4/5" />
          </View>
          <View className="my-5">
            <Divider />
          </View>
          <View className="gap-4">
            <Skeleton height={14} className="w-full" />
            <View className="flex-row gap-3">
              <Skeleton height={14} className="flex-1" />
              <Skeleton height={14} className="flex-1" />
            </View>
          </View>
        </View>
        {/* Journey — rel tanpa kartu */}
        <SkeletonSection>
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center gap-3">
              <Skeleton shape="circle" width={40} height={40} />
              <View className="flex-1 gap-2">
                <Skeleton height={14} className="w-1/2" />
                <Skeleton height={12} className="w-2/3" />
              </View>
            </View>
          ))}
        </SkeletonSection>
        {/* Baris-baris polos */}
        <SkeletonSection>
          <SkeletonText lines={2} />
          <Divider />
          <Skeleton height={14} className="w-3/5" />
        </SkeletonSection>
        <SkeletonSection>
          <SkeletonText lines={3} />
        </SkeletonSection>
      </View>
    </Screen>
  )
}
