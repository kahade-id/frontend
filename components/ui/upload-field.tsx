/**
 * Kahade — <UploadField> (§9.2 turunan; dasar untuk KYC Upload §9.19).
 *
 * Kontrol unggah satu berkas dengan 4 state:
 *   - idle      : kotak bergaris putus (border-dashed) berisi ikon UploadSimple,
 *                 teks ajakan, dan caption batasan format/ukuran. Tap = pilih.
 *   - uploading : baris berkas (ikon jenis, nama, ukuran) + <ProgressBar>
 *                 (value 0–100, atau indeterminate bila `progress` undefined).
 *   - done      : baris berkas + ikon CheckCircle success + tombol hapus (X).
 *   - error     : border-error + helper merah, tombol "Coba lagi".
 *
 * Pemilih berkas SENGAJA tidak di dalam komponen (non-obvious): expo-image-
 * picker / expo-document-picker belum terpasang dan pilihan kamera vs galeri
 * vs dokumen adalah keputusan alur (KYC: kamera dulu). Komponen ini hanya UI
 * + state; pemanggil menyambungkan `onPick` ke picker apa pun, lalu memvalidasi
 * lewat `validateUploadFile()` yang diekspor di sini agar aturan §9.19
 * (JPG/PNG/PDF, maks 10MB) tetap satu sumber. Kompresi foto ke ~2MB juga
 * tugas pemanggil sebelum upload (§9.19) — komponen tidak menyentuh binary.
 *
 * Lain-lain:
 *   - Ukuran berkas dirender Mono (`monoBody`) sebagai data presisi (§3.1).
 *   - Ikon jenis berkas mengikuti mime/ekstensi (FilePdf vs Image) tone
 *     default; state done memakai ikon CheckCircle tone success (satu-satunya
 *     warna semantik, untuk status — §2.3).
 *   - Border dashed hanya di state idle: setelah ada berkas, kotak jadi
 *     border solid default seperti Card, menandai "sudah terisi".
 *   - Thumbnail gambar sengaja TIDAK ditampilkan di sini (butuh <Picture> &
 *     uri lokal) — biarkan KYC Viewer (kelompok domain) yang menanganinya.
 */
import { ArrowsClockwise, CheckCircle, FilePdf, Image as ImageIcon, UploadSimple, X } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Field, type FieldProps } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
import { formatFileSize } from "@/lib/format"

export type UploadFileKind = "jpg" | "png" | "pdf"
export type UploadStatus = "idle" | "uploading" | "done" | "error"

export type UploadFile = {
  name: string
  /** Byte */
  size: number
  /** mime type dari picker (image/jpeg, image/png, application/pdf) */
  mimeType?: string
  uri?: string
}

/** §9.19 — batasan default upload KYC */
export const UPLOAD_DEFAULT_ACCEPT: readonly UploadFileKind[] = ["jpg", "png", "pdf"]
export const UPLOAD_DEFAULT_MAX_MB = 10

const KIND_LABEL: Record<UploadFileKind, string> = { jpg: "JPG", png: "PNG", pdf: "PDF" }

export function detectUploadKind(file: Pick<UploadFile, "name" | "mimeType">): UploadFileKind | null {
  const mime = file.mimeType?.toLowerCase()
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "application/pdf") return "pdf"
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "jpg" || ext === "jpeg") return "jpg"
  if (ext === "png") return "png"
  if (ext === "pdf") return "pdf"
  return null
}

/**
 * Validasi berkas terhadap format & ukuran. Mengembalikan pesan error (id)
 * atau null bila sah — pemanggil meneruskannya ke `errorText`.
 */
export function validateUploadFile(
  file: UploadFile,
  opts: { accept?: readonly UploadFileKind[]; maxSizeMB?: number } = {},
): string | null {
  const accept = opts.accept ?? UPLOAD_DEFAULT_ACCEPT
  const maxMB = opts.maxSizeMB ?? UPLOAD_DEFAULT_MAX_MB
  const kind = detectUploadKind(file)
  if (!kind || !accept.includes(kind)) {
    return `Format tidak didukung. Gunakan ${accept.map((k) => KIND_LABEL[k]).join(", ")}.`
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `Ukuran berkas melebihi ${maxMB} MB.`
  }
  return null
}

export type UploadFieldProps = Omit<ViewProps, "children"> &
  Pick<FieldProps, "label" | "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    file?: UploadFile | null
    status?: UploadStatus
    /** 0–100; undefined saat uploading = indeterminate */
    progress?: number
    /** Dipanggil saat area idle ditekan — sambungkan ke picker */
    onPick: () => void
    onRemove?: () => void
    /** Dipanggil dari tombol "Coba lagi" di state error (default: onPick) */
    onRetry?: () => void
    accept?: readonly UploadFileKind[]
    maxSizeMB?: number
    /** Teks ajakan di state idle */
    title?: string
    disabled?: boolean
    className?: string
    containerClassName?: string
  }

export function UploadField({
  file,
  status = file ? "done" : "idle",
  progress,
  onPick,
  onRemove,
  onRetry,
  accept = UPLOAD_DEFAULT_ACCEPT,
  maxSizeMB = UPLOAD_DEFAULT_MAX_MB,
  title = "Pilih berkas",
  disabled = false,
  label,
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  className,
  containerClassName,
  ...rest
}: UploadFieldProps) {
  const hasError = status === "error" || !!errorText
  const constraint = `${accept.map((k) => KIND_LABEL[k]).join(", ")} · maks ${maxSizeMB} MB`
  const kind = file ? detectUploadKind(file) : null
  const FileGlyph = kind === "pdf" ? FilePdf : ImageIcon

  const box = cn(
    "w-full rounded-md bg-surface",
    hasError
      ? "border-error border-border-error"
      : status === "idle"
        ? "border border-dashed border-border-control"
        : "border border-border-control",
    className,
  )

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText ?? (status === "idle" ? undefined : constraint)}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
      {...rest}
    >
      {status === "idle" || !file ? (
        <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${constraint}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPick}
          containerClassName="w-full"
          className={cn(box, "min-h-[112px] items-center justify-center gap-2 p-5")}
        >
          <Icon icon={UploadSimple} size="lg" />
          <Text variant="body" weight={600} tone="primary">
            {title}
          </Text>
          <Text variant="caption" tone="secondary">
            {constraint}
          </Text>
        </PressableScale>
      ) : (
        <View accessible={false} className={cn(box, "gap-3 p-4", disabled && "opacity-disabled")}>
          <View className="flex-row items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Icon icon={FileGlyph} size="md" tone={status === "error" ? "default" : "active"} />

            <View className="flex-1 gap-1">
              <Text ellipsizeMode="tail" variant="body" weight={600} tone="primary" numberOfLines={1}>
                {file.name}
              </Text>
              <Text variant="monoBody" tone="secondary">
                {formatFileSize(file.size)}
              </Text>
            </View>

            {status === "done" ? (
              <Icon icon={CheckCircle} size="sm" weight="fill" tone="success" accessibilityLabel="Berhasil diunggah" />
            ) : null}

            {onRemove && status !== "uploading" ? (
              <IconButton
                icon={X}
                variant="ghost"
                size="sm"
                accessibilityLabel="Hapus berkas"
                disabled={disabled}
                onPress={onRemove}
              />
            ) : null}
          </View>

          {status === "uploading" ? (
            <ProgressBar value={progress} size="sm" accessibilityLabel="Mengunggah berkas" />
          ) : null}

          {status === "error" ? (
            <View className="flex-row items-center gap-2">
              <Icon icon={ArrowsClockwise} size="xs" tone="active" />
              <TextLink onPress={onRetry ?? onPick} disabled={disabled}>
                Coba lagi
              </TextLink>
            </View>
          ) : null}
        </View>
      )}
    </Field>
  )
}