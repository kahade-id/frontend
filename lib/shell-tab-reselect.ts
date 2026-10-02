import { useEffect, useRef } from "react"

import type { ShellTabKey } from "@/lib/shell-tabs"

const listeners = new Map<ShellTabKey, Set<() => void>>()

export function emitShellTabReselect(tab: ShellTabKey): void {
  for (const listener of Array.from(listeners.get(tab) ?? [])) listener()
}

export function useShellTabReselect(tab: ShellTabKey, onReselect: () => void): void {
  const callbackRef = useRef(onReselect)
  callbackRef.current = onReselect

  useEffect(() => {
    let tabListeners = listeners.get(tab)
    if (!tabListeners) {
      tabListeners = new Set()
      listeners.set(tab, tabListeners)
    }

    const listener = () => callbackRef.current()
    tabListeners.add(listener)
    return () => {
      tabListeners?.delete(listener)
      if (tabListeners?.size === 0) listeners.delete(tab)
    }
  }, [tab])
}
