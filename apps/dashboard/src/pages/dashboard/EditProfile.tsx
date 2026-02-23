import { useMemo, useState } from 'react';
import { FloppyDiskBack, PencilSimpleLine, UserCircle } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '@kahade/ui';
import { Button } from '@kahade/ui';
import { toast } from 'sonner';
import { userApi } from '@kahade/utils';

export default function EditProfile() {
 const { user } = useAuth();
 const [form, setForm] = useState({
 username: user?.username || '',
 email: user?.email || '',
 phone: user?.phone || '',
 bio: '',
 });

 const profileCompletion = useMemo(() => {
 const fields = [form.username, form.email, form.phone, form.bio];
 const filled = fields.filter(Boolean).length;
 return Math.round((filled / fields.length) * 100);
 }, [form]);

 const handleSave = () => {
 toast.success('Perubahan profil tersimpan (demo).');
 };

 return (
 <DashboardLayout title="Edit Profil" subtitle="Kelola informasi akun Anda">
 <div className="max-w-2xl mx-auto space-y-5">
 <section className="bg-white border border-neutral-200 rounded-2xl p-5">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
 <UserCircle className="w-10 h-10 text-neutral-600" aria-hidden="true" weight="duotone" />
 </div>
 <div>
 <h2 className="font-semibold text-lg">{user?.username || 'Pengguna Kahade'}</h2>
 <p className="text-sm text-neutral-600">Lengkapi profil untuk meningkatkan kepercayaan transaksi.</p>
 </div>
 </div>

 <div className="mt-4">
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="text-neutral-600">Kelengkapan profil</span>
 <span className="font-medium">{profileCompletion}%</span>
 </div>
 <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
 <div className="h-full bg-black" style={{ width: `${profileCompletion}%` }} />
 </div>
 </div>
 </section>

 <section className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-4">
 <div className="flex items-center gap-2">
 <PencilSimpleLine className="w-5 h-5" aria-hidden="true" weight="regular" />
 <h3 className="font-semibold">Informasi Pribadi</h3>
 </div>

 <div className="grid md:grid-cols-2 gap-4">
 <div>
 <label className="text-sm text-neutral-600 mb-1.5 block">Nama Pengguna</label>
 <Input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
 </div>
 <div>
 <label className="text-sm text-neutral-600 mb-1.5 block">Email</label>
 <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
 </div>
 <div>
 <label className="text-sm text-neutral-600 mb-1.5 block">Nomor Telepon</label>
 <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
 </div>
 <div>
 <label className="text-sm text-neutral-600 mb-1.5 block">Bio Singkat</label>
 <Input value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Contoh: Freelancer desain" />
 </div>
 </div>

 <Button onClick={handleSave} className="w-full md:w-auto bg-black text-white hover:bg-black/90">
 <FloppyDiskBack className="w-4 h-4 mr-2" aria-hidden="true" weight="bold" />
 Simpan Perubahan
 </Button>
 </section>
 </div>
 </DashboardLayout>
 );
}
