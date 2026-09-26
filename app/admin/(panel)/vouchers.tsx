/**
 * Kahade — Admin: Voucher & Kampanye.
 *
 * Dua tab: daftar voucher (buat baru + nonaktifkan) dan daftar kampanye
 * (buat/ubah/hapus + aktifkan/jeda). Tombol "aktifkan" kampanye menerbitkan
 * voucher personal ke pengguna yang memenuhi syarat — selalu diminta
 * konfirmasi dulu.
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, FlatList, View } from "react-native"
import { Ticket, Megaphone } from "phosphor-react-native"

import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Input } from "@/components/ui/input"
import { TextArea } from "@/components/ui/text-area"
import { Select, SelectOptionList } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api"
import {
  listVouchers,
  createVoucher,
  deactivateVoucher,
  type AdminVoucherItem,
  type AdminVoucherType,
  type AdminVoucherApplicability,
  type CreateVoucherInput,
} from "@/lib/api/admin/vouchers"
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  activateCampaign,
  pauseCampaign,
  type AdminCampaignItem,
  type AdminCampaignType,
  type AdminCampaignStatus,
  type AdminMembershipRank,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from "@/lib/api/admin/campaigns"

const PAGE_LIMIT = 20

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

function formatIDR(value: number | null | undefined): string {
  return value == null ? "-" : idr.format(value)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function parseDayInput(input: string, endOfDay: boolean): string | null {
  const t = input.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T${endOfDay ? "23:59:59" : "00:00:00"}`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseIntInput(input: string): number | undefined {
  const t = input.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

function parseNumberInput(input: string): number | undefined {
  const t = input.trim().replace(",", ".")
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

const VOUCHER_TYPES: { value: AdminVoucherType; label: string }[] = [
  { value: "FEE_DISCOUNT_FLAT", label: "Diskon fee (nominal)" },
  { value: "FEE_DISCOUNT_PERCENT", label: "Diskon fee (persen)" },
  { value: "WALLET_CASHBACK", label: "Cashback wallet" },
  { value: "TOPUP_BONUS", label: "Bonus top-up" },
]

const VOUCHER_APPLICABILITIES: { value: AdminVoucherApplicability; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "BUYER_ONLY", label: "Pembeli saja" },
  { value: "SELLER_ONLY", label: "Penjual saja" },
  { value: "NEW_USER", label: "Pengguna baru" },
  { value: "DORMANT_USER", label: "Pengguna dormant" },
]

const CAMPAIGN_TYPES: { value: AdminCampaignType; label: string }[] = [
  { value: "FEE_PROMO", label: "Promo fee" },
  { value: "SUBSCRIPTION_DISCOUNT", label: "Diskon langganan" },
  { value: "CASHBACK", label: "Cashback" },
]

const CAMPAIGN_STATUSES: { value: AdminCampaignStatus; label: string }[] = [
  { value: "DRAFT", label: "Draf" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAUSED", label: "Dijeda" },
  { value: "ENDED", label: "Selesai" },
]

const MEMBERSHIP_RANKS: { value: AdminMembershipRank; label: string }[] = [
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "DIAMOND", label: "Diamond" },
]

function voucherValueLabel(v: AdminVoucherItem): string {
  if (v.discountAmount != null) return formatIDR(v.discountAmount)
  if (v.discountPercent != null)
    return `${v.discountPercent}%${v.maxDiscountAmount != null ? ` (maks ${formatIDR(v.maxDiscountAmount)})` : ""}`
  return formatIDR(v.maxDiscountAmount)
}

function campaignStatusTone(
  status: AdminCampaignStatus,
): "neutral" | "success" | "warning" | "info" {
  switch (status) {
    case "ACTIVE":
      return "success"
    case "PAUSED":
      return "warning"
    case "ENDED":
      return "neutral"
    default:
      return "info"
  }
}

function campaignStatusLabel(status: AdminCampaignStatus): string {
  return CAMPAIGN_STATUSES.find((s) => s.value === status)?.label ?? status
}

function voucherTypeLabel(type: AdminVoucherType): string {
  return VOUCHER_TYPES.find((t) => t.value === type)?.label ?? type
}

function campaignKey(c: AdminCampaignItem): string {
  return c.campaignId || c.id || ""
}

interface PaginatedResult<T> {
  data: T[]
  total?: number
  meta?: { total: number }
}

/* ------------------------------------------------------------------ */
/* Hook daftar paginasi sederhana                                       */
/* ------------------------------------------------------------------ */

function useAdminList<T>(
  loader: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  resetKey: unknown,
) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (pageToLoad: number, mode: "initial" | "more" | "refresh") => {
      if (mode === "initial") setLoading(true)
      else if (mode === "more") setLoadingMore(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await loader(pageToLoad, PAGE_LIMIT)
        const total = res.total ?? res.meta?.total ?? res.data.length
        setData((prev) => (mode === "more" ? [...prev, ...res.data] : res.data))
        setPage(pageToLoad)
        setHasMore(res.data.length >= PAGE_LIMIT && pageToLoad * PAGE_LIMIT < total)
      } catch (e) {
        setError(userMessage(e))
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [loader],
  )

  useEffect(() => {
    void load(1, "initial")
  }, [load, resetKey])

  return {
    data,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    refresh: () => load(1, "refresh"),
    loadMore: () => {
      if (!loadingMore && hasMore) void load(page + 1, "more")
    },
  }
}

/* ------------------------------------------------------------------ */
/* Form voucher                                                         */
/* ------------------------------------------------------------------ */

function VoucherForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: CreateVoucherInput) => Promise<void>
  submitting: boolean
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [voucherType, setVoucherType] = useState<AdminVoucherType>("FEE_DISCOUNT_FLAT")
  const [discountAmount, setDiscountAmount] = useState("")
  const [discountPercent, setDiscountPercent] = useState("")
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("")
  const [quota, setQuota] = useState("")
  const [maxPerUser, setMaxPerUser] = useState("1")
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [minOrderValue, setMinOrderValue] = useState("")
  const [applicableTo, setApplicableTo] = useState<AdminVoucherApplicability>("ALL")
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [applicabilitySheetOpen, setApplicabilitySheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit() {
    setFormError(null)
    if (!code.trim() || !name.trim()) {
      setFormError(translate("Kode dan nama voucher wajib diisi."))
      return
    }
    const from = parseDayInput(validFrom, false)
    const until = parseDayInput(validUntil, true)
    if (!from || !until) {
      setFormError(translate("Tanggal berlaku harus format YYYY-MM-DD."))
      return
    }
    if (new Date(until) <= new Date(from)) {
      setFormError(translate("Tanggal berakhir harus setelah tanggal mulai."))
      return
    }
    const input: CreateVoucherInput = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      voucherType,
      validFrom: from,
      validUntil: until,
      applicableTo,
    }
    if (description.trim()) input.description = description.trim()
    const amount = parseIntInput(discountAmount)
    if (amount !== undefined) input.discountAmount = amount
    const percent = parseNumberInput(discountPercent)
    if (percent !== undefined) input.discountPercent = percent
    const maxDisc = parseIntInput(maxDiscountAmount)
    if (maxDisc !== undefined) input.maxDiscountAmount = maxDisc
    const q = parseIntInput(quota)
    if (q !== undefined) input.maxUsageTotal = q
    const perUser = parseIntInput(maxPerUser)
    if (perUser !== undefined) input.maxUsagePerUser = perUser
    const minOrder = parseIntInput(minOrderValue)
    if (minOrder !== undefined) input.minOrderValue = minOrder
    try {
      await onSubmit(input)
    } catch (e) {
      setFormError(userMessage(e))
    }
  }

  return (
    <View className="gap-3">
      {formError ? (
        <Text tone="danger" accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      <Input
        label={translate("Kode voucher")}
        value={code}
        onChangeText={setCode}
        placeholder="MIS. HEMAT50"
        autoCapitalize="characters"
        maxLength={30}
        required
      />
      <Input
        label={translate("Nama voucher")}
        value={name}
        onChangeText={setName}
        maxLength={100}
        required
      />
      <TextArea
        label={translate("Deskripsi")}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        rows={2}
      />
      <Select<AdminVoucherType>
        label={translate("Tipe voucher")}
        value={voucherType}
        options={VOUCHER_TYPES.map((t) => ({ value: t.value, label: translate(t.label) }))}
        onPress={() => setTypeSheetOpen(true)}
        open={typeSheetOpen}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Nominal diskon (Rp)")}
            value={discountAmount}
            onChangeText={setDiscountAmount}
            keyboardType="numeric"
            placeholder="50000"
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Diskon (%)")}
            value={discountPercent}
            onChangeText={setDiscountPercent}
            keyboardType="decimal-pad"
            placeholder="10"
          />
        </View>
      </View>
      <Input
        label={translate("Maksimal diskon (Rp)")}
        value={maxDiscountAmount}
        onChangeText={setMaxDiscountAmount}
        keyboardType="numeric"
        placeholder="100000"
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Kuota total")}
            value={quota}
            onChangeText={setQuota}
            keyboardType="numeric"
            placeholder="1000"
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Kuota per pengguna")}
            value={maxPerUser}
            onChangeText={setMaxPerUser}
            keyboardType="numeric"
            placeholder="1"
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Berlaku dari")}
            value={validFrom}
            onChangeText={setValidFrom}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            required
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Berlaku sampai")}
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            required
          />
        </View>
      </View>
      <Input
        label={translate("Minimal nilai order (Rp)")}
        value={minOrderValue}
        onChangeText={setMinOrderValue}
        keyboardType="numeric"
        placeholder="0"
      />
      <Select<AdminVoucherApplicability>
        label={translate("Berlaku untuk")}
        value={applicableTo}
        options={VOUCHER_APPLICABILITIES.map((a) => ({ value: a.value, label: translate(a.label) }))}
        onPress={() => setApplicabilitySheetOpen(true)}
        open={applicabilitySheetOpen}
      />
      <Button loading={submitting} onPress={handleSubmit}>
        {translate("Buat voucher")}
      </Button>

      <BottomSheet
        visible={typeSheetOpen}
        onRequestClose={() => setTypeSheetOpen(false)}
        title={translate("Tipe voucher")}
        padding="none"
      >
        <SelectOptionList<AdminVoucherType>
          options={VOUCHER_TYPES.map((t) => ({ value: t.value, label: translate(t.label) }))}
          value={voucherType}
          onSelect={(v) => {
            setVoucherType(v)
            setTypeSheetOpen(false)
          }}
        />
      </BottomSheet>
      <BottomSheet
        visible={applicabilitySheetOpen}
        onRequestClose={() => setApplicabilitySheetOpen(false)}
        title={translate("Berlaku untuk")}
        padding="none"
      >
        <SelectOptionList<AdminVoucherApplicability>
          options={VOUCHER_APPLICABILITIES.map((a) => ({ value: a.value, label: translate(a.label) }))}
          value={applicableTo}
          onSelect={(v) => {
            setApplicableTo(v)
            setApplicabilitySheetOpen(false)
          }}
        />
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Form kampanye                                                        */
/* ------------------------------------------------------------------ */

function CampaignForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: AdminCampaignItem | null
  onSubmit: (input: CreateCampaignInput | UpdateCampaignInput) => Promise<void>
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [type, setType] = useState<AdminCampaignType>(initial?.type ?? "FEE_PROMO")
  const [startsAt, setStartsAt] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : "")
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? initial.endsAt.slice(0, 10) : "")
  const [promoCode, setPromoCode] = useState(initial?.promoCode ?? "")
  const [discountValue, setDiscountValue] = useState(
    initial?.discountValue != null ? String(initial.discountValue) : "",
  )
  const [discountPercent, setDiscountPercent] = useState(
    initial?.discountPercent != null ? String(initial.discountPercent) : "",
  )
  const [maxDiscount, setMaxDiscount] = useState(
    initial?.maxDiscount != null ? String(initial.maxDiscount) : "",
  )
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience ?? "")
  const [targetMinRank, setTargetMinRank] = useState<AdminMembershipRank | undefined>(
    initial?.targetMinRank ?? undefined,
  )
  const [targetDormantDays, setTargetDormantDays] = useState(
    initial?.targetDormantDays != null ? String(initial.targetDormantDays) : "",
  )
  const [targetNewUserOnly, setTargetNewUserOnly] = useState(initial?.targetNewUserOnly ?? false)
  const [maxRedemptions, setMaxRedemptions] = useState(
    initial?.maxRedemptions != null ? String(initial.maxRedemptions) : "",
  )
  const [rolloutPercent, setRolloutPercent] = useState(
    initial?.rolloutPercent != null ? String(initial.rolloutPercent) : "",
  )
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [rankSheetOpen, setRankSheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit() {
    setFormError(null)
    if (name.trim().length < 3) {
      setFormError(translate("Nama kampanye minimal 3 karakter."))
      return
    }
    const start = parseDayInput(startsAt, false)
    const end = parseDayInput(endsAt, true)
    if (!start || !end) {
      setFormError(translate("Tanggal mulai/selesai harus format YYYY-MM-DD."))
      return
    }
    if (new Date(end) <= new Date(start)) {
      setFormError(translate("Tanggal selesai harus setelah tanggal mulai."))
      return
    }
    const dv = parseIntInput(discountValue)
    const dp = parseNumberInput(discountPercent)
    const md = parseIntInput(maxDiscount)
    const dd = parseIntInput(targetDormantDays)
    const mr = parseIntInput(maxRedemptions)
    const rp = parseIntInput(rolloutPercent)
    try {
      if (initial) {
        const update: UpdateCampaignInput = {
          name: name.trim(),
          startsAt: start,
          endsAt: end,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
          ...(dv !== undefined ? { discountValue: dv } : {}),
          ...(dp !== undefined ? { discountPercent: dp } : {}),
          ...(md !== undefined ? { maxDiscount: md } : {}),
          ...(targetAudience.trim() ? { targetAudience: targetAudience.trim() } : {}),
          ...(targetMinRank ? { targetMinRank } : {}),
          ...(dd !== undefined ? { targetDormantDays: dd } : {}),
          targetNewUserOnly,
          ...(mr !== undefined ? { maxRedemptions: mr } : {}),
          ...(rp !== undefined ? { rolloutPercent: rp } : {}),
        }
        await onSubmit(update)
      } else {
        const create: CreateCampaignInput = {
          name: name.trim(),
          type,
          startsAt: start,
          endsAt: end,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
          ...(dv !== undefined ? { discountValue: dv } : {}),
          ...(dp !== undefined ? { discountPercent: dp } : {}),
          ...(md !== undefined ? { maxDiscount: md } : {}),
          ...(targetAudience.trim() ? { targetAudience: targetAudience.trim() } : {}),
          ...(targetMinRank ? { targetMinRank } : {}),
          ...(dd !== undefined ? { targetDormantDays: dd } : {}),
          targetNewUserOnly,
          ...(mr !== undefined ? { maxRedemptions: mr } : {}),
          ...(rp !== undefined ? { rolloutPercent: rp } : {}),
        }
        await onSubmit(create)
      }
    } catch (e) {
      setFormError(userMessage(e))
    }
  }

  return (
    <View className="gap-3">
      {formError ? (
        <Text tone="danger" accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      <Input
        label={translate("Nama kampanye")}
        value={name}
        onChangeText={setName}
        maxLength={100}
        required
      />
      {!initial ? (
        <Select<AdminCampaignType>
          label={translate("Tipe kampanye")}
          value={type}
          options={CAMPAIGN_TYPES.map((t) => ({ value: t.value, label: translate(t.label) }))}
          onPress={() => setTypeSheetOpen(true)}
          open={typeSheetOpen}
        />
      ) : null}
      <TextArea
        label={translate("Deskripsi")}
        value={description}
        onChangeText={setDescription}
        maxLength={1000}
        rows={2}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Mulai")}
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            required
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Selesai")}
            value={endsAt}
            onChangeText={setEndsAt}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            required
          />
        </View>
      </View>
      <Input
        label={translate("Kode promo (opsional)")}
        value={promoCode}
        onChangeText={setPromoCode}
        autoCapitalize="characters"
        maxLength={32}
      />
      <Input
        label={translate("Label audiens (opsional)")}
        value={targetAudience}
        onChangeText={setTargetAudience}
        maxLength={500}
        placeholder="MIS. Pengguna dormant 30 hari"
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Diskon (Rp)")}
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Diskon (%)")}
            value={discountPercent}
            onChangeText={setDiscountPercent}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <Input
        label={translate("Maksimal diskon (Rp)")}
        value={maxDiscount}
        onChangeText={setMaxDiscount}
        keyboardType="numeric"
      />
      <Select<AdminMembershipRank>
        label={translate("Rank minimum (opsional)")}
        value={targetMinRank}
        options={MEMBERSHIP_RANKS.map((r) => ({ value: r.value, label: translate(r.label) }))}
        onPress={() => setRankSheetOpen(true)}
        open={rankSheetOpen}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label={translate("Dormant (hari)")}
            value={targetDormantDays}
            onChangeText={setTargetDormantDays}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Input
            label={translate("Maks. penukaran")}
            value={maxRedemptions}
            onChangeText={setMaxRedemptions}
            keyboardType="numeric"
          />
        </View>
      </View>
      <Switch
        label={translate("Hanya pengguna baru")}
        value={targetNewUserOnly}
        onChange={setTargetNewUserOnly}
      />
      <Input
        label={translate("Rollout (%)")}
        value={rolloutPercent}
        onChangeText={setRolloutPercent}
        keyboardType="numeric"
        helperText={translate("Hanya bisa dinaikkan, tidak bisa diturunkan.")}
      />
      <Button loading={submitting} onPress={handleSubmit}>
        {initial ? translate("Simpan perubahan") : translate("Buat kampanye")}
      </Button>

      <BottomSheet
        visible={typeSheetOpen}
        onRequestClose={() => setTypeSheetOpen(false)}
        title={translate("Tipe kampanye")}
        padding="none"
      >
        <SelectOptionList<AdminCampaignType>
          options={CAMPAIGN_TYPES.map((t) => ({ value: t.value, label: translate(t.label) }))}
          value={type}
          onSelect={(v) => {
            setType(v)
            setTypeSheetOpen(false)
          }}
        />
      </BottomSheet>
      <BottomSheet
        visible={rankSheetOpen}
        onRequestClose={() => setRankSheetOpen(false)}
        title={translate("Rank minimum")}
        padding="none"
      >
        <SelectOptionList<AdminMembershipRank>
          options={MEMBERSHIP_RANKS.map((r) => ({ value: r.value, label: translate(r.label) }))}
          value={targetMinRank}
          onSelect={(v) => {
            setTargetMinRank(v)
            setRankSheetOpen(false)
          }}
        />
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Kartu daftar                                                         */
/* ------------------------------------------------------------------ */

function VoucherCard({
  voucher,
  onDeactivate,
  deactivating,
}: {
  voucher: AdminVoucherItem
  onDeactivate: () => void
  deactivating: boolean
}) {
  return (
    <Card>
      <CardBody className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="h3" className="flex-1">
            {voucher.code}
          </Text>
          <Badge tone={voucher.isActive ? "success" : "neutral"} dot>
            {voucher.isActive ? translate("Aktif") : translate("Nonaktif")}
          </Badge>
        </View>
        <Text variant="body" tone="secondary">
          {voucher.name}
        </Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Text variant="caption" tone="tertiary">
            {voucherTypeLabel(voucher.voucherType)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {voucherValueLabel(voucher)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {translate("Kuota")}: {voucher.usageCount ?? 0}
            {voucher.maxUsageTotal != null ? ` / ${voucher.maxUsageTotal}` : ""}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary">
          {formatDate(voucher.validFrom)} — {formatDate(voucher.validUntil)}
        </Text>
        {voucher.isActive ? (
          <Button
            variant="destructive"
            size="sm"
            loading={deactivating}
            onPress={onDeactivate}
          >
            {translate("Nonaktifkan")}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  )
}

function CampaignCard({
  campaign,
  action,
  submittingId,
  onActivate,
  onPause,
  onEdit,
  onDelete,
}: {
  campaign: AdminCampaignItem
  action: string | null
  submittingId: string | null
  onActivate: () => void
  onPause: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const busy = submittingId === campaignKey(campaign)
  const canActivate = campaign.status === "DRAFT" || campaign.status === "PAUSED"
  const canPause = campaign.status === "ACTIVE"
  return (
    <Card>
      <CardBody className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="h3" className="flex-1">
            {campaign.name}
          </Text>
          <Badge tone={campaignStatusTone(campaign.status)} dot>
            {campaignStatusLabel(campaign.status)}
          </Badge>
        </View>
        {campaign.description ? (
          <Text variant="body" tone="secondary" numberOfLines={2}>
            {campaign.description}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Text variant="caption" tone="tertiary">
            {CAMPAIGN_TYPES.find((t) => t.value === campaign.type)?.label ?? campaign.type}
          </Text>
          {campaign.promoCode ? (
            <Text variant="caption" tone="tertiary">
              {campaign.promoCode}
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary">
            {formatDate(campaign.startsAt)} — {formatDate(campaign.endsAt)}
          </Text>
          {campaign.maxRedemptions != null ? (
            <Text variant="caption" tone="tertiary">
              {translate("Penukaran")}: {campaign.currentRedemptions ?? 0} / {campaign.maxRedemptions}
            </Text>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {canActivate ? (
            <Button
              size="sm"
              loading={busy && action === "activate"}
              onPress={onActivate}
            >
              {translate("Aktifkan")}
            </Button>
          ) : null}
          {canPause ? (
            <Button
              variant="secondary"
              size="sm"
              loading={busy && action === "pause"}
              onPress={onPause}
            >
              {translate("Jeda")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            loading={busy && action === "edit"}
            onPress={onEdit}
          >
            {translate("Ubah")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={busy && action === "delete"}
            onPress={onDelete}
          >
            {translate("Hapus")}
          </Button>
        </View>
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Layar utama                                                          */
/* ------------------------------------------------------------------ */

type Tab = "voucher" | "kampanye"

const TAB_ITEMS = [
  { value: "voucher" as Tab, label: "Voucher" },
  { value: "kampanye" as Tab, label: "Kampanye" },
]

export default function AdminVouchersScreen() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("voucher")
  const [statusFilter, setStatusFilter] = useState<AdminCampaignStatus | undefined>(undefined)
  const [voucherSheetOpen, setVoucherSheetOpen] = useState(false)
  const [creatingVoucher, setCreatingVoucher] = useState(false)
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false)
  const [statusSheetOpen, setStatusSheetOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaignItem | null>(null)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionKind, setActionKind] = useState<string | null>(null)

  const vouchers = useAdminList<AdminVoucherItem>(
    useCallback((page: number, limit: number) => listVouchers({ page, limit }), []),
    "vouchers",
  )

  const campaigns = useAdminList<AdminCampaignItem>(
    useCallback(
      (page: number, limit: number) => listCampaigns({ page, limit, status: statusFilter }),
      [statusFilter],
    ),
    statusFilter ?? "all",
  )

  /* -- aksi voucher -- */

  async function handleCreateVoucher(input: CreateVoucherInput) {
    setCreatingVoucher(true)
    try {
      await createVoucher(input)
      setVoucherSheetOpen(false)
      toast.show({ tone: "success", title: translate("Voucher dibuat.") })
      void vouchers.refresh()
    } finally {
      setCreatingVoucher(false)
    }
  }

  function confirmDeactivate(voucher: AdminVoucherItem) {
    const id = voucher.id
    Alert.alert(
      translate("Nonaktifkan voucher?"),
      translate("Voucher {x} tidak bisa lagi dipakai pengguna.", { x: voucher.code }),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Nonaktifkan"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setActionId(id)
              setActionKind("deactivate")
              try {
                await deactivateVoucher(voucher.voucherId ?? id)
                toast.show({ tone: "success", title: translate("Voucher dinonaktifkan.") })
                void vouchers.refresh()
              } catch (e) {
                Alert.alert(translate("Gagal"), userMessage(e))
              } finally {
                setActionId(null)
                setActionKind(null)
              }
            })()
          },
        },
      ],
    )
  }

  /* -- aksi kampanye -- */

  async function handleSaveCampaign(input: CreateCampaignInput | UpdateCampaignInput) {
    setSavingCampaign(true)
    try {
      if (editingCampaign) {
        await updateCampaign(campaignKey(editingCampaign), input as UpdateCampaignInput)
        toast.show({ tone: "success", title: translate("Kampanye diperbarui.") })
      } else {
        await createCampaign(input as CreateCampaignInput)
        toast.show({ tone: "success", title: translate("Kampanye dibuat.") })
      }
      setCampaignSheetOpen(false)
      setEditingCampaign(null)
      void campaigns.refresh()
    } finally {
      setSavingCampaign(false)
    }
  }

  function confirmActivate(campaign: AdminCampaignItem) {
    const id = campaignKey(campaign)
    Alert.alert(
      translate("Aktifkan kampanye?"),
      translate(
        "Mengaktifkan kampanye akan menerbitkan voucher personal kepada pengguna yang memenuhi syarat. Lanjutkan?",
      ),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Aktifkan"),
          onPress: () => {
            void (async () => {
              setActionId(id)
              setActionKind("activate")
              try {
                const res = await activateCampaign(id)
                const issued = res.voucherIssuance?.issued
                toast.show({
                  tone: "success",
                  title: translate("Kampanye diaktifkan."),
                  description:
                    issued != null
                      ? translate("{x} voucher personal diterbitkan.", {
                          x: issued,
                        })
                      : undefined,
                })
                void campaigns.refresh()
              } catch (e) {
                Alert.alert(translate("Gagal"), userMessage(e))
              } finally {
                setActionId(null)
                setActionKind(null)
              }
            })()
          },
        },
      ],
    )
  }

  function handlePause(campaign: AdminCampaignItem) {
    const id = campaignKey(campaign)
    setActionId(id)
    setActionKind("pause")
    void (async () => {
      try {
        await pauseCampaign(id)
        toast.show({ tone: "success", title: translate("Kampanye dijeda.") })
        void campaigns.refresh()
      } catch (e) {
        Alert.alert(translate("Gagal"), userMessage(e))
      } finally {
        setActionId(null)
        setActionKind(null)
      }
    })()
  }

  function confirmDelete(campaign: AdminCampaignItem) {
    const id = campaignKey(campaign)
    Alert.alert(
      translate("Hapus kampanye?"),
      translate("Kampanye {x} akan dihapus. Tindakan ini tidak dapat dibatalkan.", {
        x: campaign.name,
      }),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Hapus"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setActionId(id)
              setActionKind("delete")
              try {
                await deleteCampaign(id)
                toast.show({ tone: "success", title: translate("Kampanye dihapus.") })
                void campaigns.refresh()
              } catch (e) {
                Alert.alert(translate("Gagal"), userMessage(e))
              } finally {
                setActionId(null)
                setActionKind(null)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <Screen scroll padded>
      <View className="gap-4 pb-8">
        <SegmentedControl<Tab>
          items={TAB_ITEMS.map((t) => ({ value: t.value, label: translate(t.label) }))}
          value={tab}
          onChange={setTab}
          accessibilityLabel={translate("Tab voucher dan kampanye")}
        />

        {tab === "voucher" ? (
          <View className="gap-3">
            <Button onPress={() => setVoucherSheetOpen(true)}>
              {translate("Buat voucher baru")}
            </Button>
            {vouchers.loading ? (
              <View className="items-center py-8">
                <Spinner accessibilityLabel={translate("Memuat voucher")} />
              </View>
            ) : vouchers.error ? (
              <Card>
                <CardBody className="gap-3">
                  <Text tone="danger" accessibilityRole="alert">
                    {vouchers.error}
                  </Text>
                  <Button variant="secondary" onPress={() => void vouchers.refresh()}>
                    {translate("Coba lagi")}
                  </Button>
                </CardBody>
              </Card>
            ) : vouchers.data.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={translate("Belum ada voucher")}
                description={translate("Buat voucher baru untuk mulai memberi diskon.")}
                action={
                  <Button fullWidth={false} onPress={() => setVoucherSheetOpen(true)}>
                    {translate("Buat voucher")}
                  </Button>
                }
              />
            ) : (
              <FlatList
                data={vouchers.data}
                keyExtractor={(v) => v.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View className="h-3" />}
                renderItem={({ item }) => (
                  <VoucherCard
                    voucher={item}
                    deactivating={actionId === item.id && actionKind === "deactivate"}
                    onDeactivate={() => confirmDeactivate(item)}
                  />
                )}
                onEndReached={vouchers.loadMore}
                onEndReachedThreshold={0.4}
                ListFooterComponent={
                  vouchers.loadingMore ? (
                    <View className="items-center py-4">
                      <Spinner accessibilityLabel={translate("Memuat lagi")} />
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        ) : (
          <View className="gap-3">
            <Button
              onPress={() => {
                setEditingCampaign(null)
                setCampaignSheetOpen(true)
              }}
            >
              {translate("Buat kampanye baru")}
            </Button>
            <Select<AdminCampaignStatus | "">
              label={translate("Filter status")}
              value={statusFilter ?? ""}
              options={[
                { value: "", label: translate("Semua status") },
                ...CAMPAIGN_STATUSES.map((s) => ({
                  value: s.value as AdminCampaignStatus | "",
                  label: translate(s.label),
                })),
              ]}
              onPress={() => setStatusSheetOpen(true)}
              open={statusSheetOpen}
            />
            {campaigns.loading ? (
              <View className="items-center py-8">
                <Spinner accessibilityLabel={translate("Memuat kampanye")} />
              </View>
            ) : campaigns.error ? (
              <Card>
                <CardBody className="gap-3">
                  <Text tone="danger" accessibilityRole="alert">
                    {campaigns.error}
                  </Text>
                  <Button variant="secondary" onPress={() => void campaigns.refresh()}>
                    {translate("Coba lagi")}
                  </Button>
                </CardBody>
              </Card>
            ) : campaigns.data.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title={translate("Belum ada kampanye")}
                description={translate("Buat kampanye untuk menerbitkan voucher personal.")}
                action={
                  <Button
                    fullWidth={false}
                    onPress={() => {
                      setEditingCampaign(null)
                      setCampaignSheetOpen(true)
                    }}
                  >
                    {translate("Buat kampanye")}
                  </Button>
                }
              />
            ) : (
              <FlatList
                data={campaigns.data}
                keyExtractor={(c) => c.id ?? c.campaignId}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View className="h-3" />}
                renderItem={({ item }) => (
                  <CampaignCard
                    campaign={item}
                    action={actionKind}
                    submittingId={actionId}
                    onActivate={() => confirmActivate(item)}
                    onPause={() => handlePause(item)}
                    onEdit={() => {
                      setEditingCampaign(item)
                      setCampaignSheetOpen(true)
                    }}
                    onDelete={() => confirmDelete(item)}
                  />
                )}
                onEndReached={campaigns.loadMore}
                onEndReachedThreshold={0.4}
                ListFooterComponent={
                  campaigns.loadingMore ? (
                    <View className="items-center py-4">
                      <Spinner accessibilityLabel={translate("Memuat lagi")} />
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        )}
      </View>

      {/* Sheet buat voucher */}
      <BottomSheet
        visible={voucherSheetOpen}
        onRequestClose={() => setVoucherSheetOpen(false)}
        title={translate("Buat voucher baru")}
        avoidKeyboard
      >
        <VoucherForm
          key="new-voucher"
          onSubmit={handleCreateVoucher}
          submitting={creatingVoucher}
        />
      </BottomSheet>

      {/* Sheet buat/ubah kampanye */}
      <BottomSheet
        visible={campaignSheetOpen}
        onRequestClose={() => {
          setCampaignSheetOpen(false)
          setEditingCampaign(null)
        }}
        title={editingCampaign ? translate("Ubah kampanye") : translate("Buat kampanye baru")}
        avoidKeyboard
      >
        <CampaignForm
          key={editingCampaign ? campaignKey(editingCampaign) : "new-campaign"}
          initial={editingCampaign}
          onSubmit={handleSaveCampaign}
          submitting={savingCampaign}
        />
      </BottomSheet>

      {/* Sheet filter status kampanye */}
      <BottomSheet
        visible={statusSheetOpen}
        onRequestClose={() => setStatusSheetOpen(false)}
        title={translate("Filter status")}
        padding="none"
      >
        <SelectOptionList<AdminCampaignStatus | "">
          options={[
            { value: "", label: translate("Semua status") },
            ...CAMPAIGN_STATUSES.map((s) => ({
              value: s.value as AdminCampaignStatus | "",
              label: translate(s.label),
            })),
          ]}
          value={statusFilter ?? ""}
          onSelect={(v) => {
            setStatusFilter(v === "" ? undefined : (v as AdminCampaignStatus))
            setStatusSheetOpen(false)
          }}
        />
      </BottomSheet>
    </Screen>
  )
}
