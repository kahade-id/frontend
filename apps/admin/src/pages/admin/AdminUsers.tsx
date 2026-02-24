import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlass, FunnelSimple, Download, Eye, DotsThree } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminApi } from '@kahade/utils';
import { toast } from 'sonner';
import { Button } from '@kahade/ui';

interface AdminUser {
  id: string;
  username?: string;
  name?: string;
  email: string;
  kycStatus?: string;
  status?: string;
  createdAt: string;
  totalTransactions?: number;
}

const kycCls: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NONE: 'bg-muted text-muted-foreground',
};
const statusCls: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('Semua');
  const [page, setPage] = useState(1);
  const tabs = ['Semua', 'Aktif', 'Suspended', 'KYC Pending'];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const statusMap: Record<string, string | undefined> = {
        'Semua': undefined,
        'Aktif': 'active',
        'Suspended': 'suspended',
      };
      const response = await adminApi.getUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: statusMap[tab],
      });
      setUsers(response.data?.users || response.data?.data || []);
    } catch (err: any) {
      toast.error('Gagal memuat pengguna', { description: err?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, [search, tab, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <AdminLayout title="Manajemen Pengguna" subtitle="Kelola semua pengguna platform">
      <div className="space-y-4">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map(t => <Button key={t} onClick={() => { setTab(t); setPage(1); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background' : 'text-muted-foreground hover:text-foreground'}`}>{t}</Button>)}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Cari pengguna..." className="pl-9 pr-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none w-64" />
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
          ) : users.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada pengguna ditemukan.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>{['ID','Pengguna','KYC','Status','Bergabung','Transaksi',''].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(u.username || u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.username || u.name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${kycCls[u.kycStatus || 'NONE'] || kycCls.NONE}`}>
                        {u.kycStatus || 'NONE'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${statusCls[u.status || 'active'] || ''}`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3">{u.totalTransactions ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-lg">
                        <DotsThree size={16} />
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
