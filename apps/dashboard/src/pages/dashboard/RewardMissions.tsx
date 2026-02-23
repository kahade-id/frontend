import { CalendarCheck, CheckCircle, RocketLaunch, Target } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';

const missions = [
 { title: 'Selesaikan 3 transaksi minggu ini', reward: '+150 pts', progress: '2/3', done: false },
 { title: 'Undang 1 teman baru', reward: '+100 pts', progress: '1/1', done: true },
 { title: 'Lengkapi verifikasi KYC', reward: '+200 pts', progress: 'Belum', done: false },
];

export default function RewardMissions() {
 return (
 <DashboardLayout title="Misi Reward" subtitle="Selesaikan tantangan untuk bonus poin">
 <div className="max-w-2xl mx-auto space-y-5">
 <section className="bg-white border border-neutral-200 rounded-2xl p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-neutral-600">Misi aktif bulan ini</p>
 <h2 className="text-2xl font-bold">3 Misi</h2>
 <p className="text-sm text-neutral-600 mt-1">Capai semua misi untuk bonus tambahan +300 pts.</p>
 </div>
 <Target className="w-9 h-9" aria-hidden="true" weight="duotone" />
 </div>
 </section>

 <section className="space-y-3">
 {missions.map((mission) => (
 <div key={mission.title} className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center justify-between gap-4">
 <div>
 <p className="font-medium">{mission.title}</p>
 <p className="text-sm text-neutral-600 mt-1">Progress: {mission.progress}</p>
 <p className="text-sm text-emerald-600 mt-1">Reward {mission.reward}</p>
 </div>
 {mission.done ? (
 <div className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" aria-hidden="true" weight="fill" /> Selesai</div>
 ) : (
 <Button variant="outline" className="rounded-xl">Lanjutkan</Button>
 )}
 </div>
 ))}
 </section>

 <section className="grid md:grid-cols-2 gap-4">
 <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
 <RocketLaunch className="w-5 h-5 mb-2" aria-hidden="true" weight="regular" />
 <h4 className="font-semibold text-sm">Boost mingguan</h4>
 <p className="text-sm text-neutral-600 mt-1">Aktivitas transaksi stabil 7 hari berturut-turut = bonus 75 poin.</p>
 </div>
 <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
 <CalendarCheck className="w-5 h-5 mb-2" aria-hidden="true" weight="regular" />
 <h4 className="font-semibold text-sm">Deadline misi</h4>
 <p className="text-sm text-neutral-600 mt-1">Semua misi diperbarui setiap hari Senin pukul 00:00 WIB.</p>
 </div>
 </section>
 </div>
 </DashboardLayout>
 );
}
