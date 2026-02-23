import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';
import { Textarea } from '@kahade/ui';
import { transactionApi } from '@kahade/utils';
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


// FIX (v3.3): InviteSkeletonLoader — direferensikan tapi tidak pernah didefinisikan
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


// FIX (v3.3): declineInvite function — direferensikan tapi tidak pernah didefinisikan
async function declineInvite(token: string): Promise<void> {
 try {
 await fetch(`/api/v1/invitations/${token}/decline`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 });
 } catch (err) {
 console.error('Failed to decline invite:', err);
 throw err;
 }
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
 const messageText =
 err?.response?.data?.message || 'Invite tidak ditemukan atau sudah kedaluwarsa.';
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
 const messageText =
 err?.response?.data?.message || 'Gagal menerima transaksi. Silakan coba lagi.';
 toast.error(messageText);
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <DashboardLayout title="Terima Undangan" subtitle="Konfirmasi undangan transaksi Anda">
 <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-6 ">
 {isLoading ? (
 <div className="text-gray-500 text-sm">Memuat detail undangan...</div>
 ) : error ? (
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
 <Button variant="outline" onClick={() => setLocation('/transactions')}>
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
