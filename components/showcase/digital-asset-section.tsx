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
 * CATATAN KONTRAK: payload FILE adalah fileKey. Belum ada endpoint unduh
 * file khusus buyer — tombol unduh memakai GET /v1/upload/my-file (berhasil
 * untuk pemilik; buyer mendapat pesan server apa adanya). Backend perlu
 * signed-download ber-skala buyer agar FILE benar-benar auto-delivery.
 */
import { useCallback, useEffect, useState } from "react"
import { Linking, View } from "react-native"
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
        const blob = await api.upload.downloadOwnFile(asset.payload)
        await saveBlobFile(blob, asset.label?.trim() || `aset-digital-${asset.id}`, blob.type || "application/octet-stream")
      } catch (err) {
        toast.show({ title: translate("Gagal mengunduh"), description: userMessage(err), tone: "danger" })
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
              <Button variant="secondary" onPress={() => void openLink(asset.payload)}>
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

const TYPE_OPTIONS: { value: DigitalAssetType; label: string }[] = [
  { value: "FILE", label: "File" },
  { value: "LINK", label: "Tautan" },
  { value: "LICENSE", label: "Lisensi" },
]

export function DigitalAssetsSellerManager({ showcaseId }: { showcaseId: string }) {
  const toast = useToast()
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [assetType, setAssetType] = useState<DigitalAssetType>("LINK")
  const [payload, setPayload] = useState("")
  const [label, setLabel] = useState("")
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
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

  const handleSave = useCallback(async () => {
    if (saving) return
    const value = payload.trim()
    if (!value) {
      setFormError(translate("Isi wajib diisi."))
      return
    }
    if (assetType === "LINK" && !/^https?:\/\//i.test(value)) {
      setFormError(translate("Tautan harus diawali http(s)://"))
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
  }, [saving, payload, assetType, label, showcaseId, toast, load])

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
      <Text variant="caption" tone="secondary">
        {translate("File, tautan, atau kode lisensi yang otomatis diterima pembeli setelah bayar.")}
      </Text>
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
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleSave()}>
            {translate("Tambah aset")}
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
          <Input
            label={
              assetType === "LINK"
                ? translate("URL")
                : assetType === "LICENSE"
                  ? translate("Kode lisensi")
                  : translate("fileKey upload")
            }
            value={payload}
            onChangeText={setPayload}
            placeholder={
              assetType === "LINK"
                ? "https://…"
                : assetType === "LICENSE"
                  ? "XXXX-XXXX-XXXX"
                  : translate("Hasil upload file")
            }
            maxLength={500}
            autoCapitalize="none"
            // FRM-021: khusus tipe LINK — keyboard URL + autocorrect mati agar
            // URL tidak diubah saat mengetik.
            keyboardType={assetType === "LINK" ? "url" : "default"}
            autoCorrect={assetType === "LINK" ? false : undefined}
            spellCheck={assetType === "LINK" ? false : undefined}
            autoComplete={assetType === "LINK" ? "url" : undefined}
          />
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

