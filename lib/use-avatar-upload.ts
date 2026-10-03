/**
 * useAvatarUpload — alur upload avatar terpadu (item 66, mega-batch 2026-09-28).
 *
 * Dipakai ProfileEditSheet (inline edit) dan app/edit-profile.tsx (layar edit
 * lengkap); menggantikan dua salinan kode upload yang identik sebelumnya.
 *
 * Fitur item 66:
 * - Progress bar saat mengunggah (ProgressBar indeterminate — fetch tidak
 *   mengekspos progress byte, jadi jangan klaim persen palsu).
 * - Pesan error inline + tombol "Coba lagi" saat gagal: aset yang sudah
 *   dipilih disimpan (pendingRef) agar retry tidak memaksa pilih ulang.
 *
 * UPI-08: G-04 lama ("avatarKey yang terupload tapi confirm-nya gagal adalah
 * orphan → hapus best-effort") SUDAH TIDAK BERLAKU. Di alur direct saat ini,
 * `uploadAvatarDirect` LANGSUNG mem-publish avatar ke DB — jadi key yang
 * "gagal di-confirm" sebenarnya adalah avatar LIVE user. Menghapusnya justru
 * merusak avatar (404). Karena itu TIDAK ADA cleanup orphan di sini; bila
 * confirm gagal transien, avatar tetap live dan aman.
 */
import { useCallback, useRef, useState } from "react"

import { api, userMessage } from "@/lib/api"
import { translate } from "@/lib/i18n/translate"
import { pickImage, pickedImageToFormData, resizePickedImage, type PickedImage, type PickImageOptions } from "@/lib/image-picker"
import { useToast } from "@/components/ui/toast"

const AVATAR_PICKER: PickImageOptions = { square: true }

/**
 * UMD-004: batas avatar backend (`users.service.ts`): maks 2 MB, MIME hanya
 * jpeg/png/webp. Backend menolak dengan VALIDATION_ERROR generik (Inggris),
 * jadi tolak DINI dengan pesan Indonesia yang actionable. HEIC/HEIF (format
 * default kamera iPhone bila tak terkonversi) termasuk ditolak — pengguna
 * diminta memilih ulang dalam format yang didukung. Ukuran tak dilaporkan
 * platform → fail-open ke validasi server (jangan tolak buta).
 */
const AVATAR_MAX_MB = 2
const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"]
const AVATAR_COPY = "Foto maksimal 2 MB dengan format JPG/PNG/WebP."

function validateAvatarAsset(asset: PickedImage): string | null {
  const mime = (asset.mimeType ?? "").toLowerCase()
  const extOk = /\.(jpe?g|png|webp)$/i.test(asset.name ?? "")
  if (!AVATAR_ALLOWED_MIME.includes(mime) && !extOk) return AVATAR_COPY
  if (typeof asset.size === "number" && asset.size > AVATAR_MAX_MB * 1024 * 1024) return AVATAR_COPY
  return null
}

export type UseAvatarUploadOptions = {
  /** Dipanggil dengan URL avatar baru (atau null bila avatar dihapus). */
  onAvatarUrl: (url: string | null) => void
  /** Dipanggil setelah upload/hapus berhasil (mis. refresh profil). */
  onChanged?: () => void
}

export type UseAvatarUpload = {
  /** true saat mengunggah/menghapus. */
  busy: boolean
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
  // Aset yang sudah dipilih dipertahankan untuk retry tanpa pilih ulang.
  const pendingRef = useRef<PickedImage | null>(null)

  const performUpload = useCallback(async () => {
    const asset = pendingRef.current
    if (!asset) return
    setBusy(true)
    setError(null)
    try {
      // PERF-FIX (2026-09-30): resize avatar sebelum upload (fail-open).
      const uploaded = await api.users.uploadAvatarDirect(await pickedImageToFormData(await resizePickedImage(asset)))
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
      const message = userMessage(err)
      setError(message)
      toast.show({ title: translate("Gagal mengunggah foto"), description: message, tone: "danger" })
    } finally {
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
      // UMD-004: guard klien — tolak >2 MB / MIME tak didukung sebelum
      // pratinjau & upload, jangan biarkan gagal misterius di server.
      const guardError = validateAvatarAsset(picked.asset)
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

  return { busy, error, preview, upload, confirmPreview, cancelPreview, retry, remove, clearError }
}
