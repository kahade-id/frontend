/**
 * Kahade — rute /story/[userId] (THIN SHELL, pola app/chat/[roomId].tsx).
 *
 * Viewer story fullscreen dimuat lazy: rute ini tidak ikut dievaluasi saat boot.
 * `?highlight=<id>` membuka arsip sorotan alih-alih story aktif.
 */
import { Suspense, lazy } from "react"

import { Screen } from "@/components/ui/screen"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useLocalSearchParams } from "expo-router"

const StoryViewerScreen = lazy(() => import("@/components/screens/story-viewer-screen"))

export default function StoryViewerRoute() {
  const params = useLocalSearchParams<{ userId: string; highlight?: string }>()
  return (
    <Suspense
      fallback={
        <Screen edges={["top"]} padded={false}>
          <LoadingScreen />
        </Screen>
      }
    >
      <StoryViewerScreen userId={String(params.userId ?? "")} highlightId={params.highlight ? String(params.highlight) : null} />
    </Suspense>
  )
}
