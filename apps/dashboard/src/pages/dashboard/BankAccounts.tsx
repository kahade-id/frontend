import { useState } from 'react';
import { Plus, DotsThree, Bank, X } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const accounts = [
 { bank: 'BCA', number: '**** 1234', name: 'Ahmad Rizki', isDefault: true },
 { bank: 'Mandiri', number: '**** 5678', name: 'Ahmad Rizki', isDefault: false },
];

export default function BankAccounts() {
 const [showAdd, setShowAdd] = useState(false);
 const [form, setForm] = useState({ bank: '', number: '', name: '' });

 return (
 <DashboardLayout>
 <div className="p-6 max-w-3xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold">Rekening Bank</h1>
 <p className="text-sm text-muted-foreground mt-1">Kelola rekening bank untuk penarikan dana</p>
 </div>
 <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={18} /> Tambah Rekening</button>
 </div>

 {accounts.length > 0 ? (
 <div className="space-y-3">
 {accounts.map((acc, i) => (
 <div key={i} className={`card p-5 flex items-center justify-between ${acc.isDefault ? 'border-primary/30 bg-primary/2' : ''}`}>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
 <Bank size={24} className="text-muted-foreground" weight="duotone" />
 </div>
 <div>
 <p className="font-bold">{acc.bank} {acc.number}</p>
 <p className="text-sm text-muted-foreground">a.n. {acc.name}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {acc.isDefault && <span className="badge badge-success text-xs">Default</span>}
 <button className="p-2 rounded-xl hover:bg-muted transition-colors"><DotsThree size={20} /></button>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="py-24 text-center">
 <Bank size={48} className="text-muted-foreground/30 mx-auto mb-4" weight="thin" />
 <p className="font-semibold text-muted-foreground">Belum ada rekening tersimpan</p>
 <p className="text-sm text-muted-foreground mt-1 mb-6">Tambahkan rekening untuk menarik dana</p>
 <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={18} /> Tambah Rekening Bank</button>
 </div>
 )}

 {/* Add Modal */}
 {showAdd && (
 <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
 <div className="bg-background rounded-3xl p-8 w-full max-w-md">
 <div className="flex items-center justify-between mb-6">
 <h2 className="font-bold text-lg">Tambah Rekening Bank</h2>
 <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl hover:bg-muted transition-colors"><X size={20} /></button>
 </div>
 <div className="space-y-4">
 <div>
 <label htmlFor="bank-name" className="text-sm font-medium mb-1.5 block">Pilih Bank</label>
 <select id="bank-name" value={form.bank} onChange={e => setForm({...form, bank: e.target.value})} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground text-sm appearance-none">
 <option value="">Pilih bank...</option>
 {['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'CIMB Niaga', 'Permata'].map(b => <option key={b}>{b}</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="account-number" className="text-sm font-medium mb-1.5 block">Nomor Rekening</label>
 <input id="account-number" type="text" placeholder="1234567890" value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground text-sm" />
 </div>
 <div>
 <label htmlFor="account-owner" className="text-sm font-medium mb-1.5 block">Nama Pemilik Rekening</label>
 <input id="account-owner" type="text" placeholder="Sesuai buku tabungan" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground text-sm" />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Batal</button>
 <button className="btn-primary flex-1">Simpan Rekening</button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </DashboardLayout>
 );
}
