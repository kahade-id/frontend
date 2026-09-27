/**
 * Kahade landing — scroll halus ke anchor section (web).
 * No-op di native.
 */
import { Platform } from "react-native"

export function scrollToSection(id: string) {
  if (Platform.OS !== "web") return
  if (typeof document === "undefined") return
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}
