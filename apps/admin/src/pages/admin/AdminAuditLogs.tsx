import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlass, Info, CheckCircle, Warning, FunnelSimple } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { adminApi } from '@kahade/utils';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  action: string;
  actorId?: string;
  actor?: { email?: string };
  targetId?: string;
  details?: string;
  severity?: string;
  createdAt: string;
}

const severityBadge: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const iconMap: Record<string, any> = {
  info: Info, success: CheckCircle, warning: Warning, error: Warning,
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('Semua');
  const severities = ['Semua', 'Info', 'Sukses', 'Peringatan', 'Error'];
  const severityMap: Record<string, string | undefined> = {
    'Semua': undefined, 'Info': 'info', 'Sukses': 'success', 'Peringatan': 'warning', 'Error': 'error',
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAuditLogs({ limit: 50 });
      setLogs(response.data?.logs || response.data?.data || []);
    } catch (err: any) {
      toast.error('Gagal memuat audit log', { description: err?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    const matchSeverity = severity === 'Semua' || l.severity === severityMap[severity];
    const matchSearch = !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.actor?.email || '').includes(search) ||
      (l.details || '').toLowerCase().includes(search.toLowerCase());
    return matchSeverity && matchSearch;
  });

  return (
    <AdminLayout title="Audit Log" subtitle="Riwayat semua aktivitas admin platform">
      <div className="space-y-4">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {severities.map(s => (
            <button key={s} onClick={() => setSeverity(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${severity === s ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari log..."
                className="pl-9 pr-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none w-64" />
            </div>
            <button onClick={fetchLogs} className="btn-secondary gap-2 text-sm px-3 py-2">
              <FunnelSimple size={15} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block mb-2" />
              <p>Memuat log...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada log ditemukan.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => {
                const sev = log.severity || 'info';
                const Icon = iconMap[sev] || Info;
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${severityBadge[sev]}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm">{log.action}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[0.65rem] font-semibold ${severityBadge[sev]}`}>
                          {sev}
                        </span>
                      </div>
                      {log.details && <p className="text-xs text-muted-foreground truncate">{log.details}</p>}
                      <p className="text-[0.7rem] text-muted-foreground/70 mt-0.5">
                        by {log.actor?.email || 'system'} · {new Date(log.createdAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <span className="text-[0.65rem] text-muted-foreground/60 shrink-0 font-mono">
                      {log.id.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
