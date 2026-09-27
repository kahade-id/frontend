/**
 * Kahade — <OrderDetailSkeleton>.
 *
 * Kerangka loading halaman detail order: meniru susunan hero, journey,
 * dan kartu-kartu di bawahnya agar tidak ada lompatan layout saat data masuk.
 */
import { View, type ViewProps } from "react-native"

import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonText } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

function SkeletonCard({ className }: { className?: string }) {
  return (
    <View className={cn("gap-3 rounded-md border border-border bg-background p-5", className)}>
      <Skeleton height={16} className="w-2/5" />
      <SkeletonText lines={2} />
      <Skeleton height={14} className="w-3/5" />
    </View>
  )
}

export function OrderDetailSkeleton(props: ViewProps) {
  return (
    <Screen edges={["top"]} padded={false} {...props}>
      <Header title={translate("Detail Order")} />
      <View
        className="gap-4 px-5 pt-3"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={translate("Memuat detail order")}
      >
        {/* Hero */}
        <View className="gap-3 rounded-md border border-border bg-background p-5">
          <Skeleton height={14} className="w-1/3" />
          <Skeleton height={26} className="w-3/5" />
          <Skeleton height={20} className="w-4/5" />
          <View className="flex-row gap-3">
            <Skeleton height={14} className="flex-1" />
            <Skeleton height={14} className="flex-1" />
          </View>
        </View>
        {/* Journey */}
        <View className="gap-4 rounded-md border border-border bg-background p-5">
          <Skeleton height={16} className="w-2/5" />
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center gap-3">
              <Skeleton shape="circle" width={40} height={40} />
              <View className="flex-1 gap-2">
                <Skeleton height={14} className="w-1/2" />
                <Skeleton height={12} className="w-2/3" />
              </View>
            </View>
          ))}
        </View>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </Screen>
  )
}
