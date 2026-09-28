/**
 * Batch 139 (A06) — Konfirmasi saat meninggalkan alur dengan perubahan
 * belum tersimpan.
 *
 * Pola yang sama dipakai layar register, verify-otp, register-security, dan
 * setup-profile: dialog konfirmasi HANYA muncul bila `dirty` true. Navigasi
 * yang disengaja (submit sukses, "Lewati") memakai `leaveTo()` supaya tidak
 * dicegat penjaga — mengikuti pola `intentionalLeave` di
 * app/showcase/create.tsx (`beforeRemove` membaca kondisi dari render
 * terakhir, jadi flag harus commit dulu sebelum navigasi dieksekusi dari
 * effect).
 *
 * `onDiscard` — pembersihan opsional saat pengguna memilih membuang
 * perubahan (mis. hapus draft registrasi).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from "@react-navigation/native"

export function useLeaveConfirm(dirty: boolean, onDiscard?: () => void) {
  const router = useRouter()
  const navigation = useNavigation()
  const [intentionalLeave, setIntentionalLeave] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingAction = useRef<NavigationAction | null>(null)
  const pendingForward = useRef<(() => void) | null>(null)
  const onDiscardRef = useRef(onDiscard)
  onDiscardRef.current = onDiscard

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    pendingAction.current = data.action
    setConfirmOpen(true)
  })

  // Navigasi keluar yang disengaja — berjalan setelah `intentionalLeave`
  // commit, sehingga `beforeRemove` tidak lagi mencegat.
  useEffect(() => {
    if (!intentionalLeave) return
    const forward = pendingForward.current
    pendingForward.current = null
    const action = pendingAction.current
    pendingAction.current = null
    setIntentionalLeave(false)
    if (forward) forward()
    else if (action) navigation.dispatch(action)
    else router.back()
  }, [intentionalLeave, navigation, router])

  /** Pengguna mengonfirmasi buang perubahan → lanjutkan navigasi tertunda. */
  const confirmLeave = useCallback(() => {
    setConfirmOpen(false)
    onDiscardRef.current?.()
    setIntentionalLeave(true)
  }, [])

  /** Batal — tetap di layar, buang aksi navigasi yang tertunda. */
  const cancelLeave = useCallback(() => {
    setConfirmOpen(false)
    pendingAction.current = null
  }, [])

  /**
   * Navigasi maju yang disengaja (mis. submit sukses) — tidak memicu dialog.
   */
  const leaveTo = useCallback((fn: () => void) => {
    pendingForward.current = fn
    setIntentionalLeave(true)
  }, [])

  return { confirmOpen, confirmLeave, cancelLeave, leaveTo }
}
