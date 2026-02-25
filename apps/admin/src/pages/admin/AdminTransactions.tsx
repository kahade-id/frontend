import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlass, FunnelSimple, Download, Eye } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminApi } from '@kahade/utils';
import { toast } from 'sonner';
import { Button } from '@kahade/ui';

interface Transaction {
  id: string;
  title?: string;
  buyer?: { email?: string };
  seller?: { email?: string };
  amount?: number;
  amountMinor?: number;
  fee?: number;
  feeMinor?: number;
  status: string;
  createdAt: string;
}

const statusCls: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  DISPUTE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
};

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('Semua');
  const tabs = ['Semua', 'Aktif', 'Selesai', 'Sengketa', 'Pending', 'Dibatalkan'];
  const tabStatusMap: Record<string, string | undefined> = {
    'Semua': undefined, 'Aktif': 'ACTIVE', 'Selesai': 'COMPLETED',
    'Sengketa': 'DISPUTE', 'Pending': 'PENDING', 'Dibatalkan': 'CANCELLED',
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTransactions({ status: tabStatusMap[tab], limit: 20 });
      setTransactions(response.data?.transactions || response.data?.data || []);
    } catch (err: any) {
      toast.error('Gagal memuat transaksi', { description: err?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const formatAmount = (minor?: number, direct?: number) => {
    const val = minor != null ? minor / 100 : direct ?? 0;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const filtered = transactions.filter(t =>
    !search || t.id.toLowerCase().includes(search.toLowerCase()) ||
    (t.title?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Manajemen Transaksi" subtitle="Monitor semua transaksi platform">
      <div className="space-y-4">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map(t => (
            <Button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </Button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari transaksi..."
                className="pl-9 pr-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none w-64" />
            </div>
            <div className="flex gap-2">
              <Button  variant="secondary" className="gap-2 text-sm px-3 py-2"><FunnelSimple size={15} /> Filter</Button>
              <Button  variant="secondary" className="gap-2 text-sm px-3 py-2"><Download size={15} /> Export</Button>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block mb-2" />
              <p>Memuat data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada transaksi ditemukan.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>{['ID','Judul','Buyer','Seller','Jumlah','Status','Tanggal',''].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate">{t.title || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.buyer?.email || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.seller?.email || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{formatAmount(t.amountMinor, t.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${statusCls[t.status] || ''}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <Button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-lg">
                        <Eye size={14} />
                      </Button>
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
