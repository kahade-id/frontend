/**
 * Screen — Rekening Bank (redesign premium 2026-09-27, TIM BANK).
 *
 * GET /v1/bank-accounts → list; POST → tambah; DELETE → hapus;
 * POST /{id}/set-primary → utama; PATCH → edit nama. Form memakai BankSelect
 * dari GET /v1/public/banks (logo resmi berwarna).
 *
 * REDESIGN INI PRESENTASI MURNI: seluruh logika & kontrak API (payload
 * AddBankAccountDto, endpoint, urutan refresh, pesan toast, validasi form)
 * tidak berubah — hanya tampilan: kartu rekening premium
 * (<BankAccountCard>: avatar bank, nomor termasker, badge "Utama", baris
 * aksi), CTA primer tegas, empty state dengan aksi, dialog konfirmasi hapus.
 */
import { useCallback, useMemo, useState, useRef } from "react"
import { TextInput, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank, Plus } from "phosphor-react-native"

import { api, isApiError, type AddBankAccountDto, userMessage } from "@/lib/api"
import type { BankAccount, BankAccountReauth } from "@/lib/api/bank-accounts"
import {
  disbursementStatusCopy,
  getDisbursements,
  type Disbursement,
} from "@/lib/api/disbursements"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

import { Alert } from "@/components/ui/alert"
import { BankAccountCard } from "@/components/ui/bank-account-card"
import { BankSelect, type BankOption } from "@/components/ui/bank-select"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"

/** Label ringkas scope pencairan (tanpa jargon enum backend). */
function disbursementScopeLabel(scope: string): string {
  switch (scope) {
    case "ORDER_ESCROW":
      return "Pencairan transaksi"
    case "MILESTONE":
      return "Pencairan milestone"
    case "DISPUTE_RELEASE":
      return "Pencairan sengketa"
    case "CASHBACK":
      return "Cashback"
    case "REFERRAL":
      return "Bonus referral"
    default:
      return "Pencairan"
  }
}

/**
 * BFE-072: field bukti re-auth yang dipakai semua dialog mutasi rekening
 * (tambah, jadikan utama, hapus, ubah nama). Kolom kode MFA hanya muncul
 * setelah backend menjawab TWO_FA_REQUIRED — akun tanpa 2FA tidak diganggu.
 */
function ReauthFields({
  password,
  onPasswordChange,
  mfaRequired,
  mfa,
  onMfaChange,
  errorText,
  busy,
  autoFocusPassword = true,
}: {
  password: string
  onPasswordChange: (t: string) => void
  mfaRequired: boolean
  mfa: string
  onMfaChange: (t: string) => void
  errorText: string | null
  busy: boolean
  /** FRM-020: dialog ubah-nama fokus ke field nama dulu, bukan kata sandi. */
  autoFocusPassword?: boolean
}) {
  return (
    <View className="gap-2 pt-2">
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <PasswordField
        label="Kata sandi"
        value={password}
        onChangeText={onPasswordChange}
        required
        autoFocus={autoFocusPassword}
        disabled={busy}
        returnKeyType={mfaRequired ? "next" : "done"}
        helperText="Dibutuhkan untuk memverifikasi perubahan rekening."
      />
      {mfaRequired ? (
        <Input
          label="Kode autentikator / kode cadangan"
          value={mfa}
          onChangeText={onMfaChange}
          required
          autoCapitalize="none"
          autoCorrect={false}
          disabled={busy}
          helperText="6 digit dari aplikasi autentikator, atau kode cadangan."
        />
      ) : null}
    </View>
  )
}

export default function BankAccountsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  // Mode Tanpa Wallet Internal: penjual WAJIB punya rekening — pencairan
  // dana transaksi dikirim ke rekening utama. Saldo lama hanya bisa ditarik
  // satu arah ke rekening (CTA di bawah daftar).
  const walletEnabled = useWalletEnabled()

  /*
   * Audit: layar ini merakit sendiri state async (loading/error/refreshing +
   * useEffect). Tiga akibat yang terbukti dari kode lama:
   *   1. Tarik-untuk-menyegarkan memakai fungsi yang SAMA dengan muat-awal,
   *      dan fungsi itu membuka dengan setLoading(true). Karena cabang render
   *      `loading ? <ListLoading/>` duduk di atas isi, menarik daftar
   *      MENGGANTI rekening dengan kerangka — konten hilang sekejap.
   *   2. Request tidak pernah dibatalkan saat layar ditutup; respons telat
   *      memanggil setState pada komponen yang sudah unmount.
   *   3. Error hanya diisi di satu tempat; kegagalan pasca-mutasi cuma toast.
   * useApiQuery membereskan ketiganya: `refreshing` terpisah dari `loading`
   * (data lama tetap tampil), request dibatalkan lewat AbortSignal yang
   * diteruskan ke kedua adapter, dan error selalu lewat `userMessage(err)`.
   *
   * Kedua request tetap satu query (Promise.all) — seperti layar lain —
   * karena daftar rekening dan katalog bank selalu dibutuhkan bersamaan.
   *
   * C-02 (audit): karenanya layar ini SENGAJA tidak memakai
   * `queryKeys.bankAccounts()`. Kunci itu menyimpan `BankAccount[]` (dipakai
   * penarikan & jadwal penarikan); query di sini menyimpan objek gabungan
   * `{ accounts, banks }`. Menyatukannya akan saling meracuni bentuk data —
   * aturan lengkapnya ada di `lib/query-keys.ts`.
   */
  const query = useApiQuery<{ accounts: BankAccount[]; banks: BankOption[] }>(
    "bank-accounts",
    async (signal) => {
      const [accountList, bankList] = await Promise.all([
        api.bankAccounts.listBankAccounts(signal),
        api.public.getBanks(signal),
      ])
      return {
        accounts: accountList ?? [],
        banks: (bankList ?? []).map((b) => ({
          code: b.code,
          name: b.name,
          logo: b.logoUrl ?? undefined,
          kind: "bank" as const,
        })),
      }
    },
  )
  const accounts = useMemo(() => query.data?.accounts ?? [], [query.data])
  const banks = useMemo(() => query.data?.banks ?? [], [query.data])
  const { loading, error, refreshing } = query

  // MFE-014: `getDisbursements` selama ini tidak dipakai di layar mana pun
  // (mati suri). Dipasang di seksi "Pencairan" di bawah — status +
  // heldReason/lastError via `disbursementStatusCopy`.
  const disbursementsQuery = useApiQuery<Disbursement[]>(
    "bank-disbursements",
    (signal) => getDisbursements({ limit: 10, signal }),
  )
  const disbursements = useMemo(
    () => disbursementsQuery.data ?? [],
    [disbursementsQuery.data],
  )

  // FRM-011: rantai fokus Next Nomor rekening -> Nama pemilik rekening.
  const accountNameRef = useRef<TextInput>(null)
  const [adding, setAdding] = useState(false)
  const [bankCode, setBankCode] = useState<string | undefined>(undefined)
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")

  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)
  const [deleting, setDeleting] = useState(false)

  /*
   * BFE-072: SEMUA mutasi rekening (tambah, set utama, hapus, ubah nama)
   * menuntut bukti re-auth — backend `assertBankChangeReauth` fail-closed
   * untuk user ber-passkey (tanpa bukti → 401 "Kata sandi salah" yang
   * menyesatkan). Satu dialog aman dipakai keempatnya: kata sandi (+ kode
   * MFA bila backend menjawab TWO_FA_REQUIRED).
   *
   * Keputusan kontrak (BFE-072): `PasskeyReauthDto` backend =
   * { password?, mfaCode?, otpCode?, reauthToken? } — TIDAK ada field
   * assertion passkey/WebAuthn. User ber-passkey cukup mengirim password
   * (+mfaCode bila 2FA aktif); tidak perlu alur WebAuthn di sini.
   */
  type SecureAction =
    | { kind: "add" }
    | { kind: "setPrimary"; account: BankAccount }
  const [secureAction, setSecureAction] = useState<SecureAction | null>(null)
  const [reauthPassword, setReauthPassword] = useState("")
  const [reauthMfa, setReauthMfa] = useState("")
  const [reauthMfaRequired, setReauthMfaRequired] = useState(false)
  const [reauthError, setReauthError] = useState<string | null>(null)
  const [reauthBusy, setReauthBusy] = useState(false)

  const resetReauth = useCallback(() => {
    setReauthPassword("")
    setReauthMfa("")
    setReauthMfaRequired(false)
    setReauthError(null)
    setReauthBusy(false)
  }, [])

  const openSecureAction = useCallback(
    (action: SecureAction) => {
      resetReauth()
      setSecureAction(action)
    },
    [resetReauth],
  )

  /*
   * F-06 (audit 2026-09-22): validasi form diangkat ke SATU tempat. Sebelumnya
   * syarat tombol hidup ditulis inline di prop `disabled` (dan tidak ada pesan
   * apa pun saat terkunci), sehingga perilaku tombol dan penjelasan ke pengguna
   * bisa menyimpang. Nomor rekening dibersihkan dari non-digit lebih dulu —
   * sama dengan handler simpan — supaya spasi/pemisah hasil tempel tidak
   * membuat tombol tampak bisa ditekan padahal isinya kosong.
   */
  const cleanAccountNumberForValidation = accountNumber.replace(/\D/g, "").trim()
  const accountNameTrimmed = accountName.trim()
  const missingBank = !bankCode
  const missingAccountNumber = !cleanAccountNumberForValidation
  const missingAccountName = !accountNameTrimmed
  // SYS-C-203 (audit konsistensi 2026-10-03): validasi FE mirror backend
  // `AddBankAccountDto` — nomor rekening ^\d{6,20}$, nama pemilik 2–100
  // karakter (pola sudah ada di kontrak generated `lib/api/constraints.ts`).
  // Dulu form hanya presence-check: nomor 3 digit lolos FE lalu 400 di BE.
  const invalidAccountNumber =
    !missingAccountNumber && !/^\d{6,20}$/.test(cleanAccountNumberForValidation)
  const invalidAccountName =
    !missingAccountName &&
    (accountNameTrimmed.length < 2 || accountNameTrimmed.length > 100)
  const canSaveAccount =
    !missingBank &&
    !missingAccountNumber &&
    !missingAccountName &&
    !invalidAccountNumber &&
    !invalidAccountName
  const missingFieldsMessage =
    missingBank && missingAccountNumber && missingAccountName
      ? "Pilih bank, lalu isi nomor rekening dan nama pemiliknya."
      : missingBank
        ? "Pilih bank penerima lebih dulu."
        : missingAccountNumber && missingAccountName
          ? "Isi nomor rekening dan nama pemilik rekening."
          : missingAccountNumber
            ? "Isi nomor rekening."
            : missingAccountName
              ? "Isi nama pemilik rekening."
              : invalidAccountNumber
                ? "Nomor rekening harus 6–20 digit angka."
                : invalidAccountName
                  ? "Nama pemilik rekening minimal 2 karakter (maksimal 100)."
                  : undefined
  /*
   * Pesan hanya muncul setelah pengguna MULAI mengisi (pola FieldHelper:
   * form yang baru dibuka tidak langsung "berteriak"), lalu menyebutkan apa
   * yang masih kurang — inilah yang membuat tombol terkunci bisa dimengerti
   * tanpa melihat layar.
   */
  const formTouched = !!bankCode || accountNumber.length > 0 || accountName.trim().length > 0
  const sectionError = formTouched && !canSaveAccount ? missingFieldsMessage : undefined
  const [editTarget, setEditTarget] = useState<BankAccount | null>(null)
  const [editName, setEditName] = useState("")
  const [editing, setEditing] = useState(false)

  const buildReauth = useCallback((): BankAccountReauth => {
    const reauth: BankAccountReauth = { password: reauthPassword }
    if (reauthMfa.trim()) reauth.mfaCode = reauthMfa.trim()
    return reauth
  }, [reauthPassword, reauthMfa])

  /** BFE-072: TWO_FA_REQUIRED → tampilkan kolom kode, JANGAN tutup dialog. */
  const handleReauthFailure = useCallback(
    (err: unknown): boolean => {
      if (isApiError(err) && err.backendCode === "TWO_FA_REQUIRED") {
        setReauthMfaRequired(true)
        setReauthError(
          "Akun Anda memakai verifikasi dua langkah. Masukkan kode dari aplikasi autentikator (atau kode cadangan), lalu coba lagi.",
        )
        return true
      }
      // REAUTH_* & BANK_ACCOUNT_VERIFICATION_FAILED dipetakan ke copy jelas
      // di userMessage (BFE-075/076).
      setReauthError(userMessage(err))
      return false
    },
    [],
  )

  /** Tambah rekening — dipanggil dari dialog aman setelah kata sandi diisi. */
  const doAdd = useCallback(
    async (reauth: BankAccountReauth) => {
      const cleanAccountNumber = accountNumber.replace(/\D/g, "").trim()
      // SYS-C-203: guard ulang pola kontrak sebelum submit (backend menolak
      // 400 bila lolos — dialog aman hanya terbuka saat canSaveAccount).
      if (
        !bankCode ||
        !bankName.trim() ||
        !accountName.trim() ||
        !cleanAccountNumber ||
        !/^\d{6,20}$/.test(cleanAccountNumber) ||
        accountName.trim().length < 2 ||
        accountName.trim().length > 100
      )
        return
      const dto: AddBankAccountDto = {
        bankCode: bankCode as AddBankAccountDto["bankCode"],
        bankName: bankName.trim() || (banks.find((b) => b.code === bankCode)?.name ?? bankCode),
        accountNumber: cleanAccountNumber,
        accountName: accountName.trim(),
        // BFE-071/072: bukti re-auth di body (PasskeyReauthDto backend).
        password: reauth.password,
        ...(reauth.mfaCode ? { mfaCode: reauth.mfaCode } : {}),
      }
      await api.bankAccounts.addBankAccount(dto).then((added) => {
        // Verifikasi nama ke bank berjalan otomatis di backend. Bila gagal
        // (nama tidak cocok), rekening tetap tersimpan TAPI tidak bisa
        // menerima pencairan — user harus tahu sekarang, bukan saat dana
        // tertahan.
        if (added.isVerified === false) {
          toast.show({
            title: "Rekening ditambahkan — belum terverifikasi",
            description: "Nama pemilik tidak cocok dengan data bank. Periksa lalu tambah ulang.",
            tone: "warning",
            duration: 5000,
          })
        } else {
          toast.show({ title: "Rekening berhasil ditambahkan", tone: "success", duration: 3000 })
        }
      })
      setAdding(false)
      setBankName("")
      setAccountNumber("")
      setAccountName("")
      setBankCode(undefined)
      await query.refresh()
    },
    [bankCode, bankName, accountNumber, accountName, banks, toast.show, query],
  )

  /** Tombol "Simpan rekening" → buka dialog aman (BFE-072), bukan langsung kirim. */
  const requestAdd = useCallback(() => {
    if (!canSaveAccount) return
    openSecureAction({ kind: "add" })
  }, [canSaveAccount, openSecureAction])

  const confirmSecureAction = useCallback(async () => {
    if (!secureAction || reauthBusy || !reauthPassword.trim()) return
    setReauthBusy(true)
    setReauthError(null)
    try {
      const reauth = buildReauth()
      if (secureAction.kind === "add") {
        await doAdd(reauth)
      } else {
        await api.bankAccounts.setPrimaryBankAccount(secureAction.account.id, reauth)
        toast.show({ title: "Rekening utama diperbarui", tone: "success", duration: 3000 })
        await query.refresh()
      }
      setSecureAction(null)
      resetReauth()
    } catch (err: unknown) {
      handleReauthFailure(err)
    } finally {
      setReauthBusy(false)
    }
  }, [
    secureAction,
    reauthBusy,
    reauthPassword,
    buildReauth,
    doAdd,
    toast.show,
    query,
    handleReauthFailure,
    resetReauth,
  ])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting || !reauthPassword.trim()) return
    setDeleting(true)
    setReauthError(null)
    try {
      // BFE-071: body { password } — backend dereferensiasi dto.password.
      await api.bankAccounts.deleteBankAccount(deleteTarget.id, buildReauth())
      toast.show({ title: "Rekening dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      resetReauth()
      await query.refresh()
    } catch (err: unknown) {
      handleReauthFailure(err)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, reauthPassword, buildReauth, toast.show, query, handleReauthFailure, resetReauth])

  const handleSetPrimary = useCallback(
    (acc: BankAccount) => {
      if (acc.isPrimary) return
      openSecureAction({ kind: "setPrimary", account: acc })
    },
    [openSecureAction],
  )

  /** Edit = ganti nama pemilik saja — backend hanya menerima `{accountName}`. */
  const handleEdit = useCallback(async () => {
    if (!editTarget || !editName.trim() || editing || !reauthPassword.trim()) return
    setEditing(true)
    setReauthError(null)
    try {
      // BFE-071: UpdateBankAccountDto juga extends PasskeyReauthDto — re-auth
      // ikut di body yang sama.
      await api.bankAccounts.updateBankAccountName(editTarget.id, editName, buildReauth())
      toast.show({ title: "Rekening diperbarui", tone: "success", duration: 3000 })
      setEditTarget(null)
      resetReauth()
      await query.refresh()
    } catch (err: unknown) {
      handleReauthFailure(err)
    } finally {
      setEditing(false)
    }
  }, [editTarget, editName, editing, reauthPassword, buildReauth, toast.show, query, handleReauthFailure, resetReauth])

  return (
    // SEC-404 (selective): layar rekening bank menampilkan data sensitif
    // (nomor rekening, nama pemilik) — blokir screenshot/recording per-layar.
    <ScreenCaptureGuard>
      <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Rekening Bank" />
      <PullToRefresh
        onRefresh={() => {
          void query.refresh()
          void disbursementsQuery.refresh()
        }}
        refreshing={refreshing || disbursementsQuery.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <SectionHeader title="Rekening terdaftar" />
        {!walletEnabled ? (
          <Alert tone="info" title="Wajib untuk penjual" className="mb-3">
            Pencairan dana transaksi dikirim ke rekening utama Anda.
          </Alert>
        ) : null}
        {accounts.some((a) => a.isVerified === false) ? (
          <Alert tone="warning" title="Ada rekening belum terverifikasi" className="mb-3">
            Pencairan dana hanya dikirim ke rekening terverifikasi. Pastikan
            nama pemilik sesuai data bank, lalu tambah ulang rekening tersebut.
          </Alert>
        ) : null}
        <Crossfade loading={loading} skeleton={<ListLoading />}>
          {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
          ) : accounts.length === 0 ? (
            <Card>
              <EmptyState
                // UI-W017: ikon tempat sampah untuk state kosong terbaca sebagai
                // aksi hapus — pakai ikon bank yang netral.
                icon={Bank}
                title="Belum ada rekening"
                description="Tambahkan rekening bank untuk menarik dana."
                // Tanpa `action`: tombol "Tambah rekening" sudah ada di seksi
                // bawah (dobel bila keduanya tampil; laporan produk 2026-09-28).
              />
            </Card>
          ) : (
            <View className="gap-3">
              {accounts.map((acc) => (
                <BankAccountCard
                  key={acc.id}
                  bankName={acc.bankName ?? acc.bankCode}
                  bankCode={acc.bankCode}
                  accountNumber={acc.accountNumber ?? ""}
                  accountHolder={acc.accountName}
                  // UI-W003: logo harus dari bank milik baris ini — dulu memakai
                  // bank yang sedang dipilih di form tambah (salah untuk semua baris).
                  logo={banks.find((b) => b.code === acc.bankCode)?.logo ?? undefined}
                  primary={acc.isPrimary}
                  verified={acc.isVerified}
                  onSetPrimary={() => void handleSetPrimary(acc)}
                  onEdit={() => {
                    resetReauth()
                    setEditTarget(acc)
                    setEditName(acc.accountName ?? "")
                  }}
                  onDelete={() => {
                    resetReauth()
                    setDeleteTarget(acc)
                  }}
                />
              ))}
            </View>
          )}
        </Crossfade>

        {!walletEnabled ? (
          <Button
            variant="secondary"
            className="mt-3"
            onPress={() => router.push(ROUTES.withdraw)}
          >
            Tarik sisa saldo lama
          </Button>
        ) : null}

        {/* MFE-014: seksi "Pencairan" — status pencairan dana transaksi ke
            rekening bank seller (escrow order, milestone, cashback, referral)
            yang selama ini tidak terlihat di mana pun. */}
        <SectionHeader title="Pencairan" />
        <Crossfade loading={disbursementsQuery.loading} skeleton={<ListLoading />}>
          {disbursementsQuery.error ? (
            <ErrorState
              title="Gagal memuat pencairan"
              description={disbursementsQuery.error}
              onRetry={() => void disbursementsQuery.reload()}
            />
          ) : disbursements.length === 0 ? (
            <Card>
              <EmptyState
                icon={Bank}
                title="Belum ada pencairan"
                description="Pencairan dana transaksi ke rekening bank akan tampil di sini."
              />
            </Card>
          ) : (
            <View className="gap-3">
              {disbursements.map((d) => {
                const copy = disbursementStatusCopy(d)
                return (
                  <Card key={d.id}>
                    <View className="flex-row items-center justify-between">
                      <Text variant="body" weight={600}>
                        {disbursementScopeLabel(d.scope)}
                      </Text>
                      <Text variant="body" weight={600}>
                        {formatRupiah(d.amount)}
                      </Text>
                    </View>
                    <Text variant="caption" tone="primary" className="mt-1">
                      {copy.title}
                    </Text>
                    {copy.description ? (
                      <Text variant="caption" tone="secondary" className="mt-1">
                        {copy.description}
                      </Text>
                    ) : null}
                  </Card>
                )
              })}
            </View>
          )}
        </Crossfade>

        <SectionHeader title="Tambah rekening" />
        {!adding ? (
          <Button leftIcon={Plus} onPress={() => setAdding(true)}>
            Tambah rekening
          </Button>
        ) : (
          <Card>
            <FormSection
              title="Data rekening baru"
              /*
               * F-06 (audit 2026-09-22): tombol simpan terkunci selama ada isian
               * yang kurang, dan sebelumnya TIDAK ADA satu pun pesan — pengguna
               * pembaca layar menekan tombol yang tidak merespons apa pun tanpa
               * tahu bagian mana yang belum benar. Pesan per-field dipakai bila
               * field itu memang sudah disentuh, sisanya dirangkum di sini
               * sebagai satu live region.
               */
              errorText={sectionError}
            >
              <BankSelect
                banks={banks}
                value={bankCode}
                onChange={(code) => {
                  setBankCode(code)
                  setBankName((prev) => prev || (banks.find((b) => b.code === code)?.name ?? ""))
                }}
                label="Bank"
              />
              <Field label="Nomor rekening" required>
                <Input
                  value={accountNumber}
                  onChangeText={(t) => setAccountNumber(t.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  // FRM-011: Next memindahkan fokus ke Nama pemilik rekening.
                  onSubmitEditing={() => accountNameRef.current?.focus()}
                  placeholder="1234567890"
                  maxLength={20}
                />
              </Field>
              <Field label="Nama pemilik rekening" required>
                <Input
                  ref={accountNameRef}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Sesuai rekening"
                  // Nama orang: kapitalisasi otomatis + isi dari kontak, dan tombol
                  // "Selesai" karena ini field terakhir sebelum CTA.
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="done"
                  maxLength={100}
                />
              </Field>
              <Text variant="caption" tone="secondary">
                Nama pemilik diverifikasi otomatis ke data bank.
              </Text>
              <Button
                onPress={() => requestAdd()}
                disabled={!canSaveAccount}
              >
                Simpan rekening
              </Button>
              <Button
                variant="ghost"
                fullWidth={false}
                onPress={() => setAdding(false)}
              >
                Batal
              </Button>
            </FormSection>
          </Card>
        )}
      </PullToRefresh>

      <Dialog
        title="Hapus rekening?"
        /* Audit: nomor rekening ditulis PENUH di sini, padahal
           <BankAccountListItem> sengaja memaskernya — docblock komponen itu
           menyebut alasannya: "daftar rekening sering terlihat orang lain saat
           user memilih tujuan tarik dana (§14)". Dialog modal justru lebih
           terbuka: `description` dirender sebagai <Text> dan ikut dibacakan
           screen reader, jadi nomor lengkap bisa terdengar di tempat umum.
           Dimasker agar konsisten dengan daftar; nama bank + 4 digit terakhir
           tetap cukup untuk memastikan rekening mana yang dihapus. */
        description={translate("{x} {y} akan dihapus dari daftar.", {
          x: deleteTarget?.bankName ?? "",
          y: deleteTarget ? maskAccountNumber(deleteTarget.accountNumber ?? "") : "",
        })}
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          resetReauth()
        }}
        onRequestClose={() => {
          setDeleteTarget(null)
          resetReauth()
        }}
      >
        {/* BFE-072: bukti re-auth wajib sebelum hapus. */}
        <ReauthFields
          password={reauthPassword}
          onPasswordChange={setReauthPassword}
          mfaRequired={reauthMfaRequired}
          mfa={reauthMfa}
          onMfaChange={setReauthMfa}
          errorText={reauthError}
          busy={deleting}
        />
      </Dialog>

      <Dialog
        title="Ubah nama pemilik"
        /* Sama seperti dialog hapus: nomor rekening dimasker, bukan ditulis
           penuh (docblock <BankAccountListItem>: daftar rekening sering
           terlihat orang lain; dialog ikut dibacakan screen reader). */
        description={translate("Hanya nama pemilik yang bisa diubah — nomor {x} tetap sama.", {
          x: editTarget ? maskAccountNumber(editTarget.accountNumber ?? "") : "",
        })}
        visible={!!editTarget}
        loading={editing}
        confirmLabel="Simpan"
        cancelLabel="Batal"
        onConfirm={() => void handleEdit()}
        onCancel={() => {
          setEditTarget(null)
          resetReauth()
        }}
        onRequestClose={() => {
          setEditTarget(null)
          resetReauth()
        }}
      >
        <Input
          value={editName}
          onChangeText={setEditName}
          placeholder="Nama pemilik rekening"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={100}
          // FRM-020: keyboard muncul otomatis; Enter/Selesai langsung menyimpan.
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void handleEdit()}
        />
        {/* BFE-072: bukti re-auth wajib sebelum ubah nama. Fokus ke field
            nama dulu (autoFocusPassword=false) — kata sandi di bawahnya. */}
        <ReauthFields
          password={reauthPassword}
          onPasswordChange={setReauthPassword}
          mfaRequired={reauthMfaRequired}
          mfa={reauthMfa}
          onMfaChange={setReauthMfa}
          errorText={reauthError}
          busy={editing}
          autoFocusPassword={false}
        />
      </Dialog>

      {/*
       * BFE-072: dialog verifikasi keamanan untuk mutasi tambah & jadikan
       * utama — backend fail-closed tanpa bukti re-auth (PasskeyReauthDto).
       */}
      <Dialog
        title={secureAction?.kind === "add" ? "Verifikasi keamanan" : "Jadikan rekening utama?"}
        description={
          secureAction?.kind === "add"
            ? translate("Masukkan kata sandi untuk menambahkan rekening {x}.", {
                x: bankName.trim() || bankCode || "",
              })
            : translate("{x} {y} akan dijadikan rekening utama untuk pencairan dana.", {
                x: secureAction?.account.bankName ?? "",
                y: secureAction?.account
                  ? maskAccountNumber(secureAction.account.accountNumber ?? "")
                  : "",
              })
        }
        visible={secureAction !== null}
        loading={reauthBusy}
        confirmLabel={secureAction?.kind === "add" ? "Simpan rekening" : "Jadikan utama"}
        cancelLabel="Batal"
        onConfirm={() => void confirmSecureAction()}
        onCancel={() => {
          setSecureAction(null)
          resetReauth()
        }}
        onRequestClose={() => {
          setSecureAction(null)
          resetReauth()
        }}
      >
        <ReauthFields
          password={reauthPassword}
          onPasswordChange={setReauthPassword}
          mfaRequired={reauthMfaRequired}
          mfa={reauthMfa}
          onMfaChange={setReauthMfa}
          errorText={reauthError}
          busy={reauthBusy}
        />
      </Dialog>
      </Screen>
    </ScreenCaptureGuard>
  )
}
