import { useState } from 'react';
import { Gear } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '@kahade/ui';

const sections = ['Umum','Keuangan','Notifikasi','Keamanan','Sistem'];

export default function AdminSettings() {
 const [active, setActive] = useState('Umum');
 const [fee, setFee] = useState('2.5');
 const [security, setSecurity] = useState({
  require2fa: true,
  ipWhitelist: false,
  rateLimit: true,
 });

 const toggleSecurity = (key: keyof typeof security) => {
  setSecurity((prev) => ({ ...prev, [key]: !prev[key] }));
 };

 return (
 <AdminLayout title="Pengaturan Platform" subtitle="Konfigurasi sistem dan parameter platform">
 <div className="grid md:grid-cols-[180px_1fr] gap-6">
 <div className="space-y-1">
 {sections.map(s => (
 <Button key={s} onClick={() => setActive(s)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{s}</Button>
 ))}
 </div>
 <div className="card p-6 space-y-5">
 {active === 'Umum' && (
 <>
 <h2 className="font-bold text-lg">Pengaturan Umum</h2>
 {[['Nama Platform','Kahade'],['Domain','kahade.id'],['Email Support','halo@kahade.id'],['Nomor Support','+62 811-127-812']].map(([label, val]) => (
 <div key={label} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
 <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{val}</p></div>
 <Button type="button"  variant="secondary" className="text-xs py-1.5 px-3">Edit</Button>
 </div>
 ))}
 </>
 )}
 {active === 'Keuangan' && (
 <>
 <h2 className="font-bold text-lg">Konfigurasi Keuangan</h2>
 <div className="border-b border-border pb-5">
 <p className="font-medium text-sm mb-2">Biaya Platform (%)</p>
 <div className="flex items-center gap-3">
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
 <input type="number" value={fee} onChange={e => setFee(e.target.value)} step="0.1" min="0" max="10" className="pl-8 pr-4 h-10 rounded-xl border-2 border-border bg-background text-sm focus:outline-none focus:border-foreground w-28" />
 </div>
 <p className="text-xs text-muted-foreground">Biaya saat ini: <strong>{fee}%</strong> per transaksi</p>
 </div>
 </div>
 {[['Minimum Deposit','Rp 10.000'],['Minimum Penarikan','Rp 50.000'],['Max Penarikan/Hari','Rp 50.000.000']].map(([label, val]) => (
 <div key={label} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
 <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{val}</p></div>
 <Button type="button"  variant="secondary" className="text-xs py-1.5 px-3">Edit</Button>
 </div>
 ))}
 <Button type="button"  variant="primary" >Simpan Konfigurasi</Button>
 </>
 )}
 {active === 'Keamanan' && (
 <>
 <h2 className="font-bold text-lg">Pengaturan Keamanan</h2>
 {[
 ['Wajib 2FA untuk Admin', 'require2fa'],
 ['IP Whitelist Aktif', 'ipWhitelist'],
 ['Rate Limit API', 'rateLimit'],
 ].map(([label, key]) => {
  const enabled = security[key as keyof typeof security];
  return (
  <div key={String(label)} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
 <p className="font-medium text-sm">{label}</p>
 <Button type="button" onClick={() => toggleSecurity(key as keyof typeof security)} className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`} aria-label={`Toggle ${label}`}>
 <div className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${enabled ? 'translate-x-5' : ''}`} />
 </Button>
 </div>
  );
 })}
 <Button type="button"  variant="primary" >Simpan Konfigurasi Keamanan</Button>
 </>
 )}
 {(active === 'Notifikasi' || active === 'Sistem') && (
 <div className="py-16 text-center">
 <Gear size={48} className="text-muted-foreground/20 mx-auto mb-4" weight="thin" />
 <p className="font-semibold text-muted-foreground">Pengaturan {active}</p>
 <p className="text-sm text-muted-foreground mt-1">Fitur ini akan tersedia segera.</p>
 </div>
 )}
 </div>
 </div>
 </AdminLayout>
 );
}
