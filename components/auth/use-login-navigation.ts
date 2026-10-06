/**
 * Shared navigation helpers for the password, WhatsApp and social login flows.
 * Auth decisions stay in their method-specific forms; this hook only carries
 * the pending destination across the verification screens and finishes login.
 */
import { useCallback } from "react"
import { useRouter } from "expo-router"

import { clearLoginIdentifier } from "@/lib/login-identifier"
import { resolvePostLoginTarget, setPendingNext } from "@/lib/login-redirect"

export function useLoginNavigation(nextPath?: string) {
  const router = useRouter()

  const beginLogin = useCallback(() => {
    setPendingNext(nextPath)
  }, [nextPath])

  const finishLogin = useCallback(async () => {
    clearLoginIdentifier()
    const target = await resolvePostLoginTarget(nextPath)
    router.replace(target as never)
  }, [nextPath, router])

  return { router, beginLogin, finishLogin }
}
