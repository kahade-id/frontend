/**
 * Kahade — konfirmasi saat meninggalkan form yang kotor (Batch 139, A06).
 *
 * Pola seragam untuk layar registrasi: dialog konfirmasi HANYA bila ada
 * perubahan yang belum tersimpan (`dirty`). Menangani:
 * - Tombol kembali header / gesture / hardware back → dicegat
 *   `usePreventRemove` (@react-navigation/native; bekerja dengan expo-router,
 *   pola yang sama dipakai app/showcase/create.tsx).
 * - Web: `beforeunload` bila tab ditutup dengan form kotor.
 * - Navigasi yang disengaja (submit sukses, "Lewati") → panggil
 *   `markLeaving()` DULU supaya penjaga tidak ikut campur.
 *
 * Pengembalian:
 * - `dialogProps` → sebar ke <Dialog> sistem.
 * - `requestClose()` → untuk tombol keluar kustom (mis. "Lewati").
 * - `markLeaving()` → matikan penjaga sebelum navigasi yang disengaja.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from "@react-navigation/native"
import { useRouter } from "expo-router"

export type LeaveConfirmOptions = {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Aksi kustom saat user mengonfirmasi keluar (mis. setup-profile "Lewati"
   * yang harus membersihkan state lalu replace). Bila tidak diisi, aksi
   * navigasi yang tertunda dijalankan (atau router.back()).
   */
  onConfirmDiscard?: () => void
}

export function useLeaveConfirm(dirty: boolean, options: LeaveConfirmOptions = {}) {
  const router = useRouter()
  const navigation = useNavigation()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [intentionalLeave, setIntentionalLeave] = useState(false)
  const pendingNavigation = useRef<NavigationAction | null>(null)
  const onConfirmDiscardRef = useRef(options.onConfirmDiscard)
  onConfirmDiscardRef.current = options.onConfirmDiscard

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    pendingNavigation.current = data.action
    setDiscardOpen(true)
  })

  // Navigasi keluar yang disengaja — dieksekusi setelah penjaga mati.
  useEffect(() => {
    if (!intentionalLeave) return
    const custom = onConfirmDiscardRef.current
    const action = pendingNavigation.current
    pendingNavigation.current = null
    if (custom) {
      custom()
    } else if (action) {
      navigation.dispatch(action)
    } else if (router.canGoBack()) {
      router.back()
    }
  }, [intentionalLeave, navigation, router])

  // Web: peringatan bawaan browser sebelum tab ditutup dengan form kotor.
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return
    if (typeof globalThis.addEventListener !== "function") return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    globalThis.addEventListener("beforeunload", warn)
    return () => globalThis.removeEventListener("beforeunload", warn)
  }, [dirty])

  /** Tombol keluar kustom: dialog bila kotor, langsung keluar bila bersih. */
  const requestClose = useCallback(() => {
    if (dirty) setDiscardOpen(true)
    else if (router.canGoBack()) router.back()
  }, [dirty, router])

  /** Buka dialog konfirmasi secara eksplisit (untuk aksi keluar kustom). */
  const showConfirm = useCallback(() => {
    setDiscardOpen(true)
  }, [])

  /** Panggil SEBELUM navigasi yang disengaja (submit sukses / lewati). */
  const markLeaving = useCallback(() => {
    setIntentionalLeave(true)
  }, [])

  const {
    title = "Buang perubahan?",
    description = "Perubahan yang belum tersimpan akan hilang bila Anda keluar sekarang.",
    confirmLabel = "Buang",
    cancelLabel = "Batal",
  } = options

  return {
    dialogProps: {
      visible: discardOpen,
      onRequestClose: () => setDiscardOpen(false),
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: () => {
        setDiscardOpen(false)
        setIntentionalLeave(true)
      },
    },
    requestClose,
    showConfirm,
    markLeaving,
  }
}
