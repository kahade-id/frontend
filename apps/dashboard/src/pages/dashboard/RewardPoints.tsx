import { Coins, Gift, TrendUp } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const pointHistory = [
 { label: 'Transaksi #TRX-10293 selesai', points: 40, date: 'Hari ini' },
 { label: 'Referral user baru', points: 50, date: 'Kemarin' },
 { label: 'Misi mingguan selesai', points: 100, date: '2 hari lalu' },
];

export default function RewardPoints() {
 return (
 <DashboardLayout title="Reward Points" subtitle="Lacak akumulasi poin Anda">
 <div className="max-w-2xl mx-auto space-y-5">
 <section className="bg-black text-white rounded-2xl p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-white/70">Total poin Anda</p>
 <h2 className="text-3xl font-bold mt-1">1.240 pts</h2>
 </div>
 <Coins className="w-10 h-10 text-amber-300" aria-hidden="true" weight="duotone" />
 </div>
 <p className="text-sm text-white/80 mt-3">Kumpulkan 760 poin lagi untuk naik ke rank Gold.</p>
 </section>

 <section className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-4">
 <h3 className="font-semibold">Riwayat Poin</h3>
 {pointHistory.map((item) => (
 <div key={`${item.label}-${item.date}`} className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
 <div>
 <p className="font-medium text-sm">{item.label}</p>
 <p className="text-xs text-neutral-600">{item.date}</p>
 </div>
 <p className="text-sm font-semibold text-emerald-600">+{item.points}</p>
 </div>
 ))}
 </section>

 <section className="grid md:grid-cols-2 gap-4">
 <div className="bg-white border border-neutral-200 rounded-2xl p-4">
 <TrendUp className="w-5 h-5 mb-2" aria-hidden="true" weight="regular" />
 <h4 className="font-semibold text-sm">Tips naik poin</h4>
 <p className="text-sm text-neutral-600 mt-1">Selesaikan transaksi tanpa sengketa dan aktifkan KYC untuk bonus tambahan.</p>
 </div>
 <div className="bg-white border border-neutral-200 rounded-2xl p-4">
 <Gift className="w-5 h-5 mb-2" aria-hidden="true" weight="regular" />
 <h4 className="font-semibold text-sm">Redeem hadiah</h4>
 <p className="text-sm text-neutral-600 mt-1">Poin bisa ditukar voucher biaya admin dan bonus promosi bulanan.</p>
 </div>
 </section>
 </div>
 </DashboardLayout>
 );
}
