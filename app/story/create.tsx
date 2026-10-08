/**
 * Kahade — rute /story/create (THIN SHELL). Layar buat story dimuat lazy.
 */
import { Suspense, lazy } from "react"

import { Screen } from "@/components/ui/screen"
import { LoadingScreen } from "@/components/ui/loading-screen"

const StoryCreateScreen = lazy(() => import("@/components/screens/story-create-screen"))

export default function StoryCreateRoute() {
  return (
    <Suspense
      fallback={
        <Screen edges={["top"]} padded={false}>
          <LoadingScreen />
        </Screen>
      }
    >
      <StoryCreateScreen />
    </Suspense>
  )
}
