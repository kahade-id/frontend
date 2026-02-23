import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';
import { Textarea } from '@kahade/ui';
import { transactionApi } from '@kahade/utils';
import { logger } from '@kahade/utils';
import { toast } from 'sonner';

interface InviteTransaction {
  id: string;
  orderNumber: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  initiator?: {
    id: string;
    username?: string;
  };
}

// FIX (Issue V2-9): InviteSkeletonLoader sekarang digunakan saat loading
function InviteSkeletonLoader() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 animate-pulse">
        <div className="h-8 bg-neutral-200 rounded-xl w-3/4 mx-auto" />
        <div className="h-4 bg-neutral-200 rounded-lg w-1/2 mx-auto" />
        <div className="h-48 bg-neutral-200 rounded-2xl" />
        <div className="h-12 bg-neutral-200 rounded-xl" />
      </div>
    </div>
  );
}

// FIX (Issue V2-4): Gunakan transactionApi.declineInvite (melewati axios interceptor
// dengan CSRF token) sebagai ganti raw fetch. Jika metode belum ada di api.ts,
// tambahkan: declineInvite: (token: string) => apiClient.post(`/invitations/${token}/decline`)
// FIX (Issue V2-4): console.error → logger.warn
async function declineInvite(token: string): Promise<void> {
  try {
    await transactionApi.declineInvite(token);
  } catch (err) {
    logger.warn('Failed to decline invite', err);
    throw err;
  }
}

// FIX (Issue V2-6): Type-safe error extraction
function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (
    err !== null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response !== null &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data !== null &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data &&
    typeof (err.response.data as Record<string, unknown>).message === 'string'
  ) {
    return (err.response.data as { message: string }).message;
  }
  return fallback;
}

export default function AcceptTransactionInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [invite, setInvite] = useState<InviteTransaction | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError('Invite token tidak ditemukan.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await transactionApi.getInvite(token);
        setInvite(response.data);
      } catch (err: unknown) {
        // FIX (Issue V2-6): Type-safe error message extraction
        const messageText = extractApiErrorMessage(err, 'Invite tidak ditemukan atau sudah kedaluwarsa.');
        setError(messageText);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const response = await transactionApi.acceptInvite(token, message.trim() || undefined);
      toast.success('Transaksi berhasil diterima.');
      const transactionId = response.data?.id;
      if (transactionId) {
        setLocation(`/transactions/${transactionId}`);
      } else {
        setLocation('/transactions');
      }
    } catch (err: unknown) {
      // FIX (Issue V2-6): Type-safe error message extraction
      const messageText = extractApiErrorMessage(err, 'Gagal menerima transaksi. Silakan coba lagi.');
      toast.error(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await declineInvite(token);
      toast.success('Undangan berhasil ditolak.');
      setLocation('/transactions');
    } catch {
      toast.error('Gagal menolak undangan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIX (Issue V2-9): Gunakan InviteSkeletonLoader saat loading
  if (isLoading) {
    return <InviteSkeletonLoader />;
  }

  return (
    <DashboardLayout title="Terima Undangan" subtitle="Konfirmasi undangan transaksi Anda">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-6">
        {error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : invite ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Judul</p>
              <h1 className="text-2xl font-semibold text-gray-900">{invite.title}</h1>
              <p className="mt-2 text-gray-600">{invite.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Nomor Order</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{invite.orderNumber}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Nilai</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  Rp {Number(invite.amount || 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Pesan untuk pembuat transaksi (opsional)
              </label>
              <Textarea
                className="mt-2"
                placeholder="Tulis pesan singkat..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAccept} disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Terima Undangan'}
              </Button>
              <Button variant="outline" onClick={handleDecline} disabled={isSubmitting}>
                Tolak
              </Button>
              <Button variant="ghost" onClick={() => setLocation('/transactions')} disabled={isSubmitting}>
                Lihat Daftar Transaksi
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            Undangan tidak dapat ditampilkan.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
