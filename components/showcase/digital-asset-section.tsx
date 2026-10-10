/**
 * DigitalAssetSection — batch 43, item 14.
 *
 * Auto-delivery produk digital: file/link/lisensi terbuka otomatis untuk
 * buyer SETELAH bayar (server fail-closed: 403 DIGITAL_ASSET_FORBIDDEN bila
 * belum ada paid order).
 *
 * - <DigitalAssetsBuyerSection>: dipakai di detail order DIGITAL (punya
 *   showcaseId) — 403 = kartu info "terbuka setelah pembayaran".
 * - <DigitalAssetsSellerManager>: kelola aset di sisi penjual (daftar /
 *   tambah FILE|LINK|LICENSE / hapus) via endpoint seller.
 *
 * KONTRAK (BE-5, audit etalase 2026-10-10): payload FILE = fileKey hasil
 * POST /v1/upload/direct purpose=DIGITAL_ASSET (privat; PDF/JPG/PNG/WebP/MP4,
 * maks 50 MB). Unduhan pembeli/pemilik lewat
 * GET /v1/commerce/digital-assets/:id/download → URL bertanda tangan 15 menit
 * (server memverifikasi order berbayar) — bukan lagi GET /v1/upload/my-file
 * yang hanya berhasil untuk pemilik.
 */
import { useCallback, useEffect, useState } from "react"
import { Linking, View } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import {
  Copy,
  DownloadSimple,
  FileArrowDown,
  Key,
  Link as LinkIcon,
  Plus,
  Trash,
} from "phosphor-react-native"
import * as Clipboard from "expo-clipboard"

import { api, isApiError, userMessage } from "@/lib/api"
import { safeHttpsLink } from "@/lib/external-url"
import {
  DIGITAL_ASSET_TYPE_LABELS,
  type DigitalAsset,
  type DigitalAssetType,
} from "@/lib/api/commerce"
import { saveBlobFile } from "@/lib/export-file"
import { uploadDirect } from "@/lib/api/upload"
import { translate } from "@/lib/i18n/translate"
import { useToast } from "@/components/ui/toast"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"

/** Batas backend UploadPurpose.DIGITAL_ASSET (upload.service.ts). */
const DIGITAL_ASSET_MAX_MB = 50
const DIGITAL_ASSET_MAX_BYTES = DIGITAL_ASSET_MAX_MB * 1024 * 1024
const DIGITAL_ASSET_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4"] as const

type PickedAssetFile = { uri: string; name: string; mimeType: string; size: number }

const ASSET_ICONS: Record<DigitalAssetType, typeof FileArrowDown> = {
  FILE: FileArrowDown,
  LINK: LinkIcon,
  LICENSE: Key,
}

function AssetRow({
  asset,
  action,
}: {
  asset: DigitalAsset
  action?: React.ReactNode
}) {
  return (
    <Card variant="outline" className="gap-1 p-3">
      <View className="flex-row items-center gap-2">
        <Icon icon={ASSET_ICONS[asset.assetType]} size="sm" tone="default" />
        <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
          {asset.label || DIGITAL_ASSET_TYPE_LABELS[asset.assetType]}
        </Text>
        {action}
      </View>
      {asset.assetType !== "FILE" ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1} className="tabular-nums">
          {asset.assetType === "LINK" ? asset.payload : `••••${asset.payload.slice(-4)}`}
        </Text>
      ) : null}
    </Card>
  )
}

export function DigitalAssetsBuyerSection({ showcaseId }: { showcaseId: string }) {
  const toast = useToast()
  const [assets, setAssets] = useState<DigitalAsset[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    api.commerce
      .listBuyerDigitalAssets(showcaseId, controller.signal)
      .then((list) => {
        if (!cancelled) {
          setAssets(list)
          setForbidden(false)
        }
      })
      .catch((err) => {
        if (cancelled) return
        // 403 = belum bayar → kartu info. Bentuk error lain = sembunyikan (soft).
        if (isApiError(err) && err.status === 403) {
          setForbidden(true)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [showcaseId])

  const copyText = useCallback(
    async (value: string, label: string) => {
      await Clipboard.setStringAsync(value)
      toast.show({ title: translate("{x} disalin", { x: label }), tone: "success" })
    },
    [toast],
  )

  const openLink = useCallback(
    async (url: string) => {
      try {
        // R-1 (audit ronde-2): URL aset digital berasal dari server — wajib
        // lolos gate https (menolak URL berkredensial & skema non-https).
        const safe = safeHttpsLink(url)
        if (!safe) throw new Error("unsafe-url")
        const supported = await Linking.canOpenURL(safe)
        if (!supported) throw new Error("unsupported")
        await Linking.openURL(safe)
      } catch {
        toast.show({ title: translate("Tautan tidak bisa dibuka"), tone: "danger" })
      }
    },
    [toast],
  )

  const downloadFile = useCallback(
    async (asset: DigitalAsset) => {
      if (downloading) return
      setDownloading(asset.id)
      try {
        // BE-5: URL bertanda tangan dari server (pemilik ATAU pembeli lunas) —
        // dulu GET /v1/upload/my-file yang hanya berhasil untuk pemilik.
        const { downloadUrl } = await api.commerce.getDigitalAssetDownload(asset.id)
        const safe = safeHttpsLink(downloadUrl)
        if (!safe) throw new Error(translate("Tautan unduhan tidak valid."))
        const res = await fetch(safe)
        if (!res.ok) throw new Error(translate("Unduhan ditolak server. Coba lagi."))
        const blob = await res.blob()
        await saveBlobFile(blob, asset.label?.trim() || `aset-digital-${asset.id}`, blob.type || "application/octet-stream")
      } catch (err) {
        toast.show({
          title: translate("Gagal mengunduh"),
          description: isApiError(err) ? userMessage(err) : err instanceof Error ? err.message : undefined,
          tone: "danger",
        })
      } finally {
        setDownloading(null)
      }
    },
    [downloading, toast],
  )

  if (forbidden) {
    return (
      <Card variant="outline" className="gap-1 p-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={FileArrowDown} size="sm" tone="default" />
          <Text variant="body" weight={600}>
            {translate("Aset digital")}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          {translate("File, tautan, dan kode lisensi terbuka otomatis setelah pembayaran terkonfirmasi.")}
        </Text>
      </Card>
    )
  }
  if (!assets || assets.length === 0) return null

  return (
    <View className="gap-2">
      <Text variant="body" weight={600}>
        {translate("Aset digital")}
      </Text>
      {assets.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          action={
            asset.assetType === "LINK" ? (
              // VI-06: aksi baris — bukan tombol lebar penuh 48px di samping IconButton sm.
              <Button variant="secondary" size="sm" fullWidth={false} onPress={() => void openLink(asset.payload)}>
                {translate("Buka")}
              </Button>
            ) : asset.assetType === "LICENSE" ? (
              <IconButton
                icon={Copy}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Salin kode lisensi")}
                onPress={() => void copyText(asset.payload, translate("Kode lisensi"))}
              />
            ) : (
              <IconButton
                icon={DownloadSimple}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Unduh file")}
                disabled={downloading === asset.id}
                onPress={() => void downloadFile(asset)}
              />
            )
          }
        />
      ))}
    </View>
  )
}

/**
 * UX-13 → BE-5 (audit 2026-10-10): tipe FILE kembali tersedia — penjual
 * memilih berkas (document picker), aplikasi mengunggahnya lewat transport
 * terpusat (purpose DIGITAL_ASSET), fileKey-nya menjadi payload. Dulu penjual
 * diminta mengetik fileKey secara manual.
 */
const TYPE_OPTIONS: { value: DigitalAssetType; label: string }[] = [
  { value: "FILE", label: "Berkas" },
  { value: "LINK", label: "Tautan" },
  { value: "LICENSE", label: "Lisensi" },
]

/** Validasi lokal = cermin batas server (gagal cepat, pesan jujur). */
function pickedFileProblem(file: PickedAssetFile): string | null {
  if (file.size > DIGITAL_ASSET_MAX_BYTES) {
    return translate("Berkas melebihi {x} MB.", { x: DIGITAL_ASSET_MAX_MB })
  }
  if (!(DIGITAL_ASSET_MIME as readonly string[]).includes(file.mimeType)) {
    return translate("Jenis berkas tidak didukung. Gunakan PDF, JPG, PNG, WebP, atau MP4.")
  }
  return null
}

export function DigitalAssetsSellerManager({ showcaseId }: { showcaseId: string }) {
  const toast = useToast()
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [assetType, setAssetType] = useState<DigitalAssetType>("LINK")
  const [payload, setPayload] = useState("")
  const [label, setLabel] = useState("")
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  // BE-5: berkas terpilih untuk tipe FILE (diunggah saat "Tambah aset").
  const [pickedFile, setPickedFile] = useState<PickedAssetFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DigitalAsset | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await api.commerce.listSellerDigitalAssets(showcaseId)
      setAssets(list)
    } catch {
      toast.show({ title: translate("Gagal memuat aset"), tone: "danger" })
    }
  }, [showcaseId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const pickFile = useCallback(async () => {
    setFormError(undefined)
    const result = await DocumentPicker.getDocumentAsync({
      type: [...DIGITAL_ASSET_MIME],
      copyToCacheDirectory: true,
      multiple: false,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    const file: PickedAssetFile = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    }
    const problem = pickedFileProblem(file)
    if (problem) {
      setPickedFile(null)
      setFormError(problem)
      return
    }
    setPickedFile(file)
  }, [])

  const handleSave = useCallback(async () => {
    if (saving) return
    if (assetType === "FILE") {
      if (!pickedFile) {
        setFormError(translate("Pilih berkas terlebih dahulu."))
        return
      }
      const problem = pickedFileProblem(pickedFile)
      if (problem) {
        setFormError(problem)
        return
      }
      setSaving(true)
      setUploading(true)
      try {
        // Transport terpusat (XHR progress/timeout adaptif/retry) — purpose
        // DIGITAL_ASSET = privat, hanya bisa diunduh via signed URL.
        const formData = new FormData()
        formData.append("file", { uri: pickedFile.uri, name: pickedFile.name, type: pickedFile.mimeType } as unknown as Blob)
        formData.append("purpose", "DIGITAL_ASSET")
        const uploaded = await uploadDirect(formData, undefined, undefined, pickedFile.size)
        setUploading(false)
        await api.commerce.createDigitalAsset({
          showcaseId,
          assetType: "FILE",
          payload: uploaded.fileKey,
          label: label.trim() || pickedFile.name,
        })
        toast.show({ title: translate("Aset ditambahkan"), tone: "success" })
        setSheetOpen(false)
        setPickedFile(null)
        setLabel("")
        await load()
      } catch (err) {
        setFormError(userMessage(err))
      } finally {
        setUploading(false)
        setSaving(false)
      }
      return
    }
    const value = payload.trim()
    if (!value) {
      setFormError(translate("Isi wajib diisi."))
      return
    }
    // DT-08 (audit 2026-10-10): validasi yang SAMA dengan sisi pembeli
    // (`safeHttpsLink`): dulu form menerima http:// / URL berkredensial yang
    // kemudian selalu gagal dibuka pembeli ("Tautan tidak bisa dibuka").
    if (assetType === "LINK" && !safeHttpsLink(value)) {
      setFormError(translate("Tautan harus https:// dan tanpa nama pengguna/kata sandi."))
      return
    }
    setSaving(true)
    try {
      await api.commerce.createDigitalAsset({
        showcaseId,
        assetType,
        payload: value,
        label: label.trim() || undefined,
      })
      toast.show({ title: translate("Aset ditambahkan"), tone: "success" })
      setSheetOpen(false)
      setPayload("")
      setLabel("")
      await load()
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, payload, assetType, label, showcaseId, toast, load, pickedFile])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.commerce.deleteDigitalAsset(deleteTarget.id)
      toast.show({ title: translate("Aset dihapus"), tone: "success" })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast.show({ title: translate("Gagal menghapus"), description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, toast, load])

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text variant="body" weight={600} className="flex-1">
          {translate("Aset digital")}
        </Text>
        <IconButton
          icon={Plus}
          size="sm"
          variant="ghost"
          accessibilityLabel={translate("Tambah aset")}
          onPress={() => {
            setFormError(undefined)
            setSheetOpen(true)
          }}
        />
      </View>
      {assets.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          action={
            <IconButton
              icon={Trash}
              size="sm"
              variant="ghost"
              accessibilityLabel={translate("Hapus aset")}
              onPress={() => setDeleteTarget(asset)}
            />
          }
        />
      ))}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Tambah aset digital")}
        // UX-SPA-011: sheet berisi input + CTA — pola FRM-017 mewajibkan
        // avoidKeyboard agar CTA tidak tertutup keyboard di iOS.
        avoidKeyboard
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleSave()}>
            {uploading ? translate("Mengunggah berkas…") : translate("Tambah aset")}
          </Button>
        }
      >
        <View className="gap-4">
          <Field label={translate("Tipe aset")}>
            <SegmentedControl<DigitalAssetType>
              items={TYPE_OPTIONS}
              value={assetType}
              onChange={setAssetType}
              accessibilityLabel={translate("Tipe aset")}
            />
          </Field>
          {assetType === "FILE" ? (
            <Field label={translate("Berkas")} helperText={translate("PDF, JPG, PNG, WebP, atau MP4 — maks {x} MB", { x: DIGITAL_ASSET_MAX_MB })}>
              <View className="gap-2">
                {pickedFile ? (
                  <Text variant="body" numberOfLines={1}>
                    {pickedFile.name}
                  </Text>
                ) : null}
                <Button
                  variant="secondary"
                  fullWidth={false}
                  leftIcon={FileArrowDown}
                  disabled={saving}
                  onPress={() => void pickFile()}
                >
                  {pickedFile ? translate("Ganti berkas") : translate("Pilih berkas")}
                </Button>
              </View>
            </Field>
          ) : (
            <Input
              label={assetType === "LINK" ? translate("URL") : translate("Kode lisensi")}
              value={payload}
              onChangeText={setPayload}
              placeholder={assetType === "LINK" ? "https://…" : translate("Contoh: AB12-CD34-EF56")}
              maxLength={500}
              autoCapitalize="none"
              // FRM-021: khusus tipe LINK — keyboard URL + autocorrect mati agar
              // URL tidak diubah saat mengetik.
              keyboardType={assetType === "LINK" ? "url" : "default"}
              autoCorrect={assetType === "LINK" ? false : undefined}
              spellCheck={assetType === "LINK" ? false : undefined}
              autoComplete={assetType === "LINK" ? "url" : undefined}
            />
          )}
          <Input
            label={translate("Label (opsional)")}
            value={label}
            onChangeText={setLabel}
            placeholder={translate("cth: E-book PDF, Akun premium 1 bulan")}
            maxLength={100}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title={translate("Hapus aset ini?")}
        visible={deleteTarget != null}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </View>
  )
}

