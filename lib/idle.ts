/**
 * Kahade — runWhenIdle: pengganti InteractionManager.runAfterInteractions
 * (dihapus di RN 0.88).
 */
export function runWhenIdle(callback: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => callback())
  } else {
    setTimeout(callback, 0)
  }
}
