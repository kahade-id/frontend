import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlass, CheckCircle, X, Eye, Clock, IdentificationCard } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminApi } from '@kahade/utils';
import { toast } from 'sonner';

interface KYCRequest {
  id: string;
  userId?: string;
  user?: { username?: string; email?: string };
  idType?: string;
  submittedAt?: string;
  createdAt?: string;
  status: string;
}

const statusCls: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminKYC() {
  const [requests, setRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Semua');
  const [search, setSearch] = useState('');
  const tabs = ['Semua', 'Pending', 'Disetujui', 'Ditolak'];
  const tabStatusMap: Record<string, string | undefined> = {
    'Semua': undefined, 'Pending': 'PENDING', 'Disetujui': 'VERIFIED', 'Ditolak': 'REJECTED',
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getKYCRequests({ status: tabStatusMap[tab], limit: 20 });
      setRequests(response.data?.requests || response.data?.data || []);
    } catch (err: any) {
      toast.error('Gagal memuat KYC', { description: err?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string, userId: string) => {
    try {
      await adminApi.approveKYC(userId);
      toast.success('KYC disetujui');
      fetchRequests();
    } catch (err: any) {
      toast.error('Gagal menyetujui KYC', { description: err?.response?.data?.message });
    }
  };

  const handleReject = async (id: string, userId: string) => {
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    try {
      await adminApi.rejectKYC(userId, reason);
      toast.success('KYC ditolak');
      fetchRequests();
    } catch (err: any) {
      toast.error('Gagal menolak KYC', { description: err?.response?.data?.message });
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING').length;

  return (
    <AdminLayout title="Verifikasi KYC" subtitle="Review dan proses pengajuan identitas">
      <div className="space-y-5">
        {pending > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-center gap-3">
            <Clock size={18} className="text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>{pending} pengajuan KYC</strong> menunggu review
            </p>
          </div>
        )}

        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari pengajuan..."
                className="pl-9 pr-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none w-64" />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block mb-2" />
              <p>Memuat data...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada pengajuan KYC.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>{['ID','Pengguna','Jenis ID','Waktu Submit','Status','Aksi'].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests
                  .filter(r => !search || r.user?.email?.includes(search) || r.user?.username?.toLowerCase().includes(search.toLowerCase()))
                  .map(r => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(r.user?.username || r.user?.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{r.user?.username || '—'}</p>
                            <p className="text-xs text-muted-foreground">{r.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.idType || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(r.submittedAt || r.createdAt || '').toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${statusCls[r.status] || ''}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 hover:bg-muted rounded-lg" title="Lihat detail">
                            <Eye size={14} />
                          </button>
                          {r.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleApprove(r.id, r.userId!)}
                                className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-green-600" title="Setujui">
                                <CheckCircle size={14} />
                              </button>
                              <button onClick={() => handleReject(r.id, r.userId!)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500" title="Tolak">
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
