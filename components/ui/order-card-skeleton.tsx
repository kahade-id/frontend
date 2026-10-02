import { View, type ViewProps } from "react-native"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"

/** Placeholder dengan tinggi menyamai OrderCard tanpa tenggat. */
export function OrderCardSkeleton({
  className,
  ...rest
}: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      className={cn(
        "w-full gap-3 rounded-md border border-border bg-surface p-5",
        className,
      )}
      accessibilityLabel="Memuat transaksi"
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Skeleton height={12} className="w-32" />
        <Skeleton height={22} className="w-24" />
      </View>
      <Skeleton height={18} className="w-full" />
      <View className="flex-row items-center gap-2">
        <Skeleton shape="circle" width={24} height={24} />
        <Skeleton height={12} className="w-40" />
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Skeleton shape="circle" width={24} height={24} />
          <Skeleton height={16} className="w-28" />
        </View>
        <Skeleton height={12} className="w-24" />
      </View>
    </View>
  )
}
