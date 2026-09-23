import { useEffect, useRef } from "react"
import { getSessionRevision } from "@/lib/api/session"
import { useSessionRevision } from "@/lib/guest-gate"

/** A synchronous lock plus route/session/unmount fence for UI mutations. */
export function useShowcaseOperation(identity: string | undefined) {
  const revision = useSessionRevision()
  const scope = `${revision}:${identity ?? "closed"}`
  const current = useRef({ scope, mounted: true, ticket: 0, busy: false })
  if (current.current.scope !== scope) current.current = { scope, mounted: true, ticket: current.current.ticket + 1, busy: false }
  useEffect(() => {
    current.current.mounted = true
    return () => { current.current.mounted = false; current.current.ticket++ }
  }, [scope])
  return {
    begin() {
      if (!identity || current.current.busy) return null
      const entry = current.current
      entry.busy = true
      const ticket = ++entry.ticket
      return {
        valid: () => current.current === entry && entry.mounted && entry.ticket === ticket && revision === getSessionRevision(),
        finish: () => { if (current.current === entry && entry.ticket === ticket) entry.busy = false },
      }
    },
  }
}
