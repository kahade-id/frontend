import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Platform } from "react-native"
import { getSecureItem, SecureKeys } from "@/lib/secure-storage"
import { refreshAccessToken } from "@/lib/api/client"
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/api/session"
import { userMessage } from "@/lib/api/errors"

const serverSnapshot = () => undefined
export function useAuthSession() {
  const token = useSyncExternalStore(subscribeSession, getSessionSnapshot, serverSnapshot)
  const [restoring, setRestoring] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setRestoring(true)
    setError(null)
    async function restore() {
      try {
        if ((await getSecureItem(SecureKeys.sessionSignedOut)) === "1") {
          await clearSession()
          return
        }
        const access = await getAccessToken()
        if (!access && (Platform.OS === "web" || (await getRefreshToken())))
          await refreshAccessToken()
      } catch (error) {
        if (alive) setError(userMessage(error))
      } finally {
        if (alive) setRestoring(false)
      }
    }
    void restore()
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { token, restoring, error, retry }
}
