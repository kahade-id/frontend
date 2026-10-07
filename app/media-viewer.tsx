/**
 * Kahade — rute /media-viewer (THIN SHELL, pola app/chat/[roomId].tsx).
 *
 * Implementasi viewer (expo-video + webview + ~5 sub-viewer) dimuat via
 * React.lazy sehingga dievaluasi HANYA saat pengguna membuka media, bukan
 * saat boot. Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ViewerLoading } from "@/components/media-viewer/viewer-chrome"

const MediaViewerScreen = lazy(() => import("@/components/screens/media-viewer-screen"))

export default function MediaViewerRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 bg-black">
          <ViewerLoading label="Membuka media…" />
        </View>
      }
    >
      <MediaViewerScreen />
    </Suspense>
  )
}
