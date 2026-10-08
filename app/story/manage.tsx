/**
 * Kahade — rute /story/manage (THIN SHELL). Kelola story, sorotan, dan bisu.
 */
import { Suspense, lazy } from "react"

import { Screen } from "@/components/ui/screen"
import { LoadingScreen } from "@/components/ui/loading-screen"

const StoryManageScreen = lazy(() => import("@/components/screens/story-manage-screen"))

export default function StoryManageRoute() {
  return (
    <Suspense
      fallback={
        <Screen edges={["top"]} padded={false}>
          <LoadingScreen />
        </Screen>
      }
    >
      <StoryManageScreen />
    </Suspense>
  )
}
