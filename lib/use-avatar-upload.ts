/**
 * useAvatarUpload — alur upload avatar terpadu (item 66, mega-batch 2026-09-28).
 *
 * Dipakai ProfileEditSheet (inline edit) dan app/edit-profile.tsx (layar edit
 * lengkap); menggantikan dua salinan kode upload yang identik sebelumnya.
 *
 * Fitur item 66:
 * - Progress bar saat mengunggah. Audit 2026-10-09 (C5): kini JUJUR —
 *   `progress` 0–1 dari byte transfer (upload direct memakai XHR
 *   `uploadFileWithProgress`; dulu fetch → tidak bisa melaporkan kemajuan).
 * - Pesan error inline + tombol "Coba lagi" saat gagal: aset yang sudah
 *   dipilih disimpan (pendingRef) agar retry tidak memaksa pilih ulang.
 * - Audit 2026-10-09 (D2): `cancelUpload()` membatalkan transfer yang
 *   sedang berjalan (AbortSignal) — dulu hasil akhirnya tetap terkirim.
 *   Pesan kegagalan via `uploadMessage` (timeout/413/5xx/offline beda-beda;
 *   "Tidak ada koneksi internet" hanya bila NetInfo memverifikasi).
 *
 * UPI-08: G-04 lama ("avatarKey yang terupload tapi confirm-nya gagal adalah
 * orphan → hapus best-effort") SUDAH TIDAK BERLAKU. Di alur direct saat ini,
 * `uploadAvatarDirect` LANGSUNG mem-publish avatar ke DB — jadi key yang
 * "gagal di-confirm" sebenarnya adalah avatar LIVE user. Menghapusnya justru
 * merusak avatar (404). Karena itu TIDAK ADA cleanup orphan di sini; bila
 * confirm gagal transien, avatar tetap live dan aman.
 */
import { useCallback, useRef, useState } from "react"

import { api, isApiError, userMessage } from "@/lib/api"
import { translate } from "@/lib/i18n/translate"
import { pickImage, pickedImageToFormData, resizePickedImage, type PickedImage, type PickImageOptions } from "@/lib/image-picker"
import { validateAvatarMime, validateAvatarSize } from "@/lib/photo-upload-guards"
import { uploadMessage } from "@/lib/upload-errors"
import { useToast } from "@/components/ui/toast"

const AVATAR_PICKER: PickImageOptions = { square: true }

export type UseAvatarUploadOptions = {
  /** Dipanggil dengan URL avatar baru (atau null bila avatar dihapus). */
  onAvatarUrl: (url: string | null) => void
  /** Dipanggil setelah upload/hapus berhasil (mis. refresh profil). */
  onChanged?: () => void
}

export type UseAvatarUpload = {
  /** true saat mengunggah/menghapus. */
  busy: boolean
  /**
   * Audit 2026-10-09 (C5): fraksi 0–1 kemajuan transfer byte (jujur, dari
   * XHR). `null` = tidak sedang mengunggah. Konsumen menampilkan ProgressBar
   * determinate saat != null, selain itu indeterminate (hapus avatar).
   */
  progress: number | null
  /** Audit 2026-10-09 (D2): batalkan upload yang sedang berjalan. */
  cancelUpload: () => void
  /** Pesan error terakhir (inline), atau null. */
  error: string | null
  /**
   * Batch 139 E02 — aset yang menunggu konfirmasi pratinjau (null bila tidak
   * ada). `upload()` TIDAK langsung mengunggah: ia memilih gambar lalu
   * mengisi `preview`; konsumen menampilkan dialog pratinjau lingkaran +
   * batas aman, dan memanggil `confirmPreview()` / `cancelPreview()`.
   */
  preview: PickedImage | null
  /** Pilih dari kamera/galeri → tampilkan pratinjau (E02). */
  upload: (source: PickImageOptions["source"]) => Promise<void>
  /** Unggah aset yang sedang dipratinjau. */
  confirmPreview: () => Promise<void>
  /** Batalkan pratinjau (buang aset yang dipilih). */
  cancelPreview: () => void
  /** Ulangi upload dengan aset yang sudah dipilih (item 66). */
  retry: () => Promise<void>
  /** Hapus avatar. */
  remove: () => Promise<void>
  clearError: () => void
}

export function useAvatarUpload({ onAvatarUrl, onChanged }: UseAvatarUploadOptions): UseAvatarUpload {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PickedImage | null>(null)
  // Audit 2026-10-09 (C5): fraksi 0–1 byte transfer saat upload berjalan.
  const [progress, setProgress] = useState<number | null>(null)
  // Aset yang sudah dipilih dipertahankan untuk retry tanpa pilih ulang.
  const pendingRef = useRef<PickedImage | null>(null)
  // Audit 2026-10-09 (D2): batalkan transfer yang sedang berjalan.
  const uploadAbortRef = useRef<AbortController | null>(null)

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort()
  }, [])

  const performUpload = useCallback(async () => {
    const asset = pendingRef.current
    if (!asset) return
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setProgress(0)
    try {
      // PERF-FIX (2026-09-30): resize avatar sebelum upload (fail-open).
      // Audit 2026-10-09 (B6/C5): `fileBytes` memicu timeout adaptif di
      // transport (satu rumus terpusat — bukan lagi pemanggil yang
      // menghitung sendiri); onProgress = fraksi byte jujur 0–1.
      const resized = await resizePickedImage(asset)
      // E-13: batas ukuran dinilai atas hasil resize (yang benar-benar
      // diunggah), bukan foto kamera mentah.
      const sizeError = validateAvatarSize(resized)
      if (sizeError) {
        setError(sizeError)
        toast.show({ title: translate("Foto tidak valid"), description: sizeError, tone: "danger" })
        return
      }
      const uploaded = await api.users.uploadAvatarDirect(await pickedImageToFormData(resized), {
        fileBytes: resized.size,
        onProgress: setProgress,
        signal: controller.signal,
      })
      // UPI-08: JANGAN anggap avatarKey sebagai orphan bila confirm gagal —
      // uploadAvatarDirect sudah mem-publish-nya sebagai avatar live.
      // confirmAvatar sendiri idempoten (no-op bila sudah live).
      if (uploaded.avatarKey) {
        await api.users.confirmAvatar({ avatarKey: uploaded.avatarKey })
      }
      pendingRef.current = null
      if (uploaded.avatarUrl) onAvatarUrl(uploaded.avatarUrl)
      onChanged?.()
      toast.show({ title: translate("Foto profil diperbarui"), tone: "success" })
    } catch (err: unknown) {
      // Audit 2026-10-09 (D2): batalkan = tanpa error & tanpa toast —
      // user sengaja menghentikan; pratinjau sudah ditutup saat confirm.
      if (isApiError(err) && err.code === "ABORTED") {
        pendingRef.current = null
        return
      }
      // Audit 2026-10-09 (A1): uploadMessage — 413 menyebut "maks 2 MB",
      // timeout = "koneksi lambat", offline hanya bila terverifikasi.
      const message = uploadMessage(err, { purpose: "AVATAR" })
      setError(message)
      toast.show({ title: translate("Gagal mengunggah foto"), description: message, tone: "danger" })
    } finally {
      uploadAbortRef.current = null
      setProgress(null)
      setBusy(false)
    }
  }, [onAvatarUrl, onChanged, toast])

  const upload = useCallback(
    async (source: PickImageOptions["source"]) => {
      if (busy) return
      const picked = await pickImage({ ...AVATAR_PICKER, source })
      if (picked.status === "denied") {
        toast.show({
          title: source === "camera" ? translate("Izin kamera ditolak") : translate("Izin galeri ditolak"),
          description: translate("Aktifkan di pengaturan perangkat."),
          tone: "danger",
        })
        return
      }
      if (picked.status !== "picked") return
      // UMD-004: guard klien — tolak MIME tak didukung sebelum pratinjau.
      // E-13: ukuran TIDAK dicek di sini (foto kamera mentah 3–8 MB lazim);
      // dicek setelah resize di performUpload.
      const guardError = validateAvatarMime(picked.asset)
      if (guardError) {
        toast.show({
          title: translate("Foto tidak valid"),
          description: guardError,
          tone: "danger",
        })
        return
      }
      // Batch 139 E02: TAHAN untuk pratinjau — jangan langsung unggah.
      // Konsumen menampilkan dialog lingkaran + batas aman.
      pendingRef.current = picked.asset
      setPreview(picked.asset)
    },
    [busy, toast],
  )

  /** Batch 139 E02: unggah aset yang sedang dipratinjau. */
  const confirmPreview = useCallback(async () => {
    if (busy || !pendingRef.current) return
    setPreview(null)
    await performUpload()
  }, [busy, performUpload])

  /** Batch 139 E02: batalkan pratinjau, buang aset yang dipilih. */
  const cancelPreview = useCallback(() => {
    pendingRef.current = null
    setPreview(null)
  }, [])

  const retry = useCallback(async () => {
    if (busy) return
    if (!pendingRef.current) {
      // Tidak ada aset tertunda (mis. error datang dari retry lama) — biarkan
      // pengguna memilih ulang lewat action sheet seperti biasa.
      setError(null)
      return
    }
    await performUpload()
  }, [busy, performUpload])

  const remove = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.users.deleteAvatar()
      pendingRef.current = null
      onAvatarUrl(null)
      onChanged?.()
      toast.show({ title: translate("Foto profil dihapus"), tone: "success" })
    } catch (err: unknown) {
      const message = userMessage(err)
      setError(message)
      toast.show({ title: translate("Gagal menghapus foto"), description: message, tone: "danger" })
    } finally {
      setBusy(false)
    }
  }, [busy, onAvatarUrl, onChanged, toast])

  const clearError = useCallback(() => setError(null), [])

  return { busy, progress, cancelUpload, error, preview, upload, confirmPreview, cancelPreview, retry, remove, clearError }
}
