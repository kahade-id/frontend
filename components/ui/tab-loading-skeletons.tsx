import { StyleSheet, View } from "react-native"

import { OrderCardSkeleton } from "@/components/ui/order-card-skeleton"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { tokens } from "@/lib/tokens"

const CHAT_SKELETON_COUNT = 7
const NOTIFICATION_SKELETON_COUNT = 5

function ChatSkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5">
      <Skeleton shape="circle" width={48} height={48} />
      <View className="min-w-0 flex-1 gap-1.5">
        <Skeleton height={14} style={{ width: "45%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
      </View>
    </View>
  )
}

export function ChatTabListSkeleton() {
  return (
    <SkeletonGroup>
      {Array.from({ length: CHAT_SKELETON_COUNT }, (_, index) => (
        <ChatSkeletonRow key={`chat-skeleton-${index}`} />
      ))}
    </SkeletonGroup>
  )
}

function NotificationSkeletonRow() {
  return (
    <View style={notificationSkeletonStyles.row}>
      <Skeleton shape="circle" width={40} height={40} />
      <View style={notificationSkeletonStyles.textCol}>
        <Skeleton height={14} style={notificationSkeletonStyles.w70} />
        <Skeleton height={12} style={notificationSkeletonStyles.w88} />
        <Skeleton height={12} style={notificationSkeletonStyles.w45} />
      </View>
    </View>
  )
}

const notificationSkeletonStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingVertical: tokens.space[3],
  },
  textCol: { flex: 1, gap: tokens.space[2] },
  w70: { width: "70%" },
  w88: { width: "88%" },
  w45: { width: "45%" },
})

export function NotificationsTabListSkeleton() {
  return (
    <SkeletonGroup>
      {Array.from({ length: NOTIFICATION_SKELETON_COUNT }, (_, index) => (
        <NotificationSkeletonRow key={index} />
      ))}
    </SkeletonGroup>
  )
}

export function TransactionsTabListSkeleton() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Memuat transaksi"
      className="gap-3 pt-1"
    >
      <OrderCardSkeleton />
      <OrderCardSkeleton />
      <OrderCardSkeleton />
    </View>
  )
}
