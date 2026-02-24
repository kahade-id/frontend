/**
 * KAHADE REFERRALS PAGE - Professional Responsive Design
 * 
 * Design Philosophy:
 * - Mobile: Card-based layout with prominent share actions
 * - Tablet/Desktop: Grid layout with stats and referral list
 * - Consistent visual hierarchy across all breakpoints
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Users, Gift, Copy, CheckCircle, Spinner, Share,
 Trophy, UserPlus, Clock, Warning, Check, CaretRight,
 Confetti, Star
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { Badge } from '@kahade/ui';
import { toast } from 'sonner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { referralApi } from '@kahade/utils';
import { UnderlineTabsSimple } from '@kahade/ui';

interface ReferralCode {
 code: string;
 usageCount: number;
 maxUsages: number;
 isActive: boolean;
 expiresAt: string;
 shareLink: string;
}

interface ReferralStats {
 referralCode: string | null;
 totalReferrals: number;
 successfulReferrals: number;
 pendingReferrals: number;
 totalEarnings: number;
 pendingEarnings: number;
}

interface Referral {
 id: string;
 referredUser: {
 username: string;
 createdAt: string;
 };
 status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'ACTIVE';
 rewardAmount: number;
 createdAt: string;
}

interface Reward {
 id: string;
 amount: number;
 rewardType: 'COMMISSION' | 'CASHBACK';
 status: 'PENDING' | 'CLAIMED' | 'EXPIRED';
 referredUser: string;
 createdAt: string;
 processedAt?: string;
}

const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0
 }).format(amount);
};

const formatRelativeTime = (dateString: string): string => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffDays < 1) return 'Hari ini';
 if (diffDays === 1) return 'Kemarin';
 if (diffDays < 7) return `${diffDays} hari lalu`;
 return new Date(dateString).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
 PENDING: { label: 'Menunggu', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
 COMPLETED: { label: 'Selesai', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: CheckCircle },
 ACTIVE: { label: 'Aktif', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: CheckCircle },
 EXPIRED: { label: 'Kedaluwarsa', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Warning },
 CLAIMED: { label: 'Diklaim', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: CheckCircle },
};

const fallbackStatus = { label: 'Tidak diketahui', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Warning };

const getStatusConfig = (status?: string) => statusConfig[status ?? ''] ?? fallbackStatus;

export default function Referrals() {
 const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
 const [stats, setStats] = useState<ReferralStats | null>(null);
 const [referrals, setReferrals] = useState<Referral[]>([]);
 const [rewards, setRewards] = useState<Reward[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isGenerating, setIsGenerating] = useState(false);
 const [copied, setCopied] = useState(false);
 const [copiedLink, setCopiedLink] = useState(false);
 const [activeTab, setActiveTab] = useState('referrals');
 const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);

 useEffect(() => {
 fetchReferralData();
 }, []);

 const fetchReferralData = async () => {
 setIsLoading(true);
 try {
 const codeRes = await referralApi.getCode();
 setReferralCode(codeRes.data);

 const [statsRes, referralsRes, rewardsRes] = await Promise.all([
 referralApi.getStats(),
 referralApi.getReferrals({ limit: 50 }),
 referralApi.getRewards({ limit: 50 }),
 ]);
 
 setStats(statsRes.data);
 
 // Safely extract referrals array
 const refData = referralsRes?.data;
 let refList: Referral[] = [];
 if (refData) {
 if (Array.isArray(refData.referrals)) refList = refData.referrals;
 else if (Array.isArray(refData.data)) refList = refData.data;
 else if (Array.isArray(refData)) refList = refData;
 }
 setReferrals(refList);
 
 // Safely extract rewards array
 const rewData = rewardsRes?.data;
 let rewList: Reward[] = [];
 if (rewData) {
 if (Array.isArray(rewData.data)) rewList = rewData.data;
 else if (Array.isArray(rewData.rewards)) rewList = rewData.rewards;
 else if (Array.isArray(rewData)) rewList = rewData;
 }
 setRewards(rewList);
 } catch (error: unknown) {
 if (error.response?.status === 404) {
 await generateReferralCode();
 } else if (error?.response?.status !== 401) {
 toast.error('Gagal memuat data referral');
 }
 setReferrals([]);
 setRewards([]);
 } finally {
 setIsLoading(false);
 }
 };

 const generateReferralCode = async () => {
 setIsGenerating(true);
 try {
 const codeRes = await referralApi.getCode();
 setReferralCode(codeRes.data);
 toast.success('Kode referral berhasil dibuat!');
 } catch (error) {
 toast.error('Gagal membuat kode referral');
 } finally {
 setIsGenerating(false);
 }
 };

 const copyReferralCode = () => {
 if (referralCode?.code) {
 navigator.clipboard.writeText(referralCode.code);
 setCopied(true);
 toast.success('Kode referral berhasil disalin!');
 setTimeout(() => setCopied(false), 2000);
 }
 };

 const copyReferralLink = () => {
 const link = referralCode?.shareLink || `${window.location.origin}/register?ref=${referralCode?.code}`;
 navigator.clipboard.writeText(link);
 setCopiedLink(true);
 toast.success('Tautan referral berhasil disalin!');
 setTimeout(() => setCopiedLink(false), 2000);
 };

 const shareReferral = async () => {
 const link = referralCode?.shareLink || `${window.location.origin}/register?ref=${referralCode?.code}`;
 if (navigator.share) {
 try {
 await navigator.share({
 title: 'Gabung Kahade',
 text: `Gunakan kode referral ${referralCode?.code} untuk bonus Rp 25.000 saat mendaftar!`,
 url: link,
 });
 } catch (error) {
 copyReferralLink();
 }
 } else {
 copyReferralLink();
 }
 };

 const claimReward = async (rewardId: string) => {
 setClaimingRewardId(rewardId);
 try {
 await referralApi.claimReward(rewardId);
 toast.success('Reward berhasil diklaim!');
 fetchReferralData();
 } catch (error: unknown) {
 toast.error(error.response?.data?.message || 'Gagal mengklaim reward');
 } finally {
 setClaimingRewardId(null);
 }
 };

 const tabs = [
 { id: 'referrals', label: 'Rujukan', count: (Array.isArray(referrals) ? referrals : []).length },
 { id: 'rewards', label: 'Hadiah', count: (Array.isArray(rewards) ? rewards : []).length },
 ];

 if (isLoading) {
 return (
 <DashboardLayout title="Rujukan" subtitle="Memuat...">
 <div className="flex items-center justify-center h-64">
 <div className="text-center">
 <Spinner className="w-10 h-10 animate-spin text-black mx-auto mb-4" aria-hidden="true" weight="bold" />
 <p className="text-neutral-600">Memuat data referral...</p>
 </div>
 </div>
 </DashboardLayout>
 );
 }

 return (
 <DashboardLayout title="Rujukan" subtitle="Undang teman dan raih reward">
 <div className="space-y-6">
 {/* ========== REFERRAL CODE CARD ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-black rounded-2xl p-4 md:p-6 lg:p-8 text-white relative overflow-hidden"
 >
 {/* Background Pattern */}
 <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true">
 <div className="absolute inset-0" aria-hidden="true" style={{
 backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
 backgroundSize: '24px 24px'
 }} />
 </div>

 <div className="relative z-10">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Gift className="w-5 h-5 text-white/60" aria-hidden="true" weight="duotone" />
 <span className="text-white/60 text-sm font-medium">Kode Referral Anda</span>
 </div>
 
 {referralCode?.code ? (
 <div className="flex items-center gap-4 mb-4">
 <div className="text-3xl md:text-4xl font-bold tracking-wider font-mono">
 {referralCode.code}
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={copyReferralCode}
 className="text-white/70 hover:text-white hover:bg-white/10 h-10 w-10 p-0 rounded-xl"
 >
 {copied ? <Check className="w-5 h-5" aria-hidden="true" weight="bold" /> : <Copy className="w-5 h-5" aria-hidden="true" weight="bold" />}
 </Button>
 </div>
 ) : (
 <Button
 onClick={generateReferralCode}
 disabled={isGenerating}
 className="bg-white text-black hover:bg-white/90 rounded-xl h-11 mb-4"
 >
 {isGenerating ? <Spinner className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <Gift className="w-4 h-4 mr-2" aria-hidden="true" />}
 Generate Code
 </Button>
 )}

 <p className="text-white/60 text-sm max-w-md">
 Bagikan kode Anda. Saat teman mendaftar dan menyelesaikan transaksi pertama, kalian berdua mendapat Rp 25.000!
 </p>
 </div>

 {/* Share Actions */}
 <div className="flex gap-3">
 <Button
 onClick={copyReferralLink}
 className="bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-xl h-11"
 >
 {copiedLink ? <Check className="w-4 h-4 mr-2" aria-hidden="true" /> : <Copy className="w-4 h-4 mr-2" aria-hidden="true" />}
 Copy Link
 </Button>
 <Button
 onClick={shareReferral}
 className="bg-white text-black hover:bg-white/90 rounded-xl h-11"
 >
 <Share className="w-4 h-4 mr-2" aria-hidden="true" weight="bold" />
 Share
 </Button>
 </div>
 </div>
 </div>
 </motion.div>

 {/* ========== STATS CARDS ========== */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-4">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.05 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
 <Users className="w-5 h-5 text-black" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.totalReferrals || 0}</div>
 <div className="text-sm text-neutral-600">Total Rujukan</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
 <CheckCircle className="w-5 h-5 text-emerald-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.successfulReferrals || 0}</div>
 <div className="text-sm text-neutral-600">Successful</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
 <Clock className="w-5 h-5 text-amber-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.pendingReferrals || 0}</div>
 <div className="text-sm text-neutral-600">Menunggu</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
 <Trophy className="w-5 h-5 text-purple-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-xl md:text-2xl font-bold text-black truncate">{formatCurrency(stats?.totalEarnings || 0)}</div>
 <div className="text-sm text-neutral-600">Total Earned</div>
 </motion.div>
 </div>

 {/* ========== REFERRALS & REWARDS LIST ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.25 }}
 className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
 >
 {/* Tabs */}
 <div className="px-4 md:px-5 pt-2">
 <UnderlineTabsSimple
 tabs={tabs}
 activeTab={activeTab}
 onTabChange={setActiveTab}
 />
 </div>

 {/* Content */}
 <div className="p-4 md:p-5">
 {activeTab === 'referrals' && (
 <>
 {(Array.isArray(referrals) ? referrals : []).length === 0 ? (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
 <UserPlus className="w-8 h-8 text-neutral-500" aria-hidden="true" weight="regular" />
 </div>
 <h4 className="text-lg font-semibold text-black mb-1">Belum Ada Rujukan</h4>
 <p className="text-sm text-neutral-600 max-w-sm mx-auto">
 Bagikan kode referral Anda ke teman untuk mulai mendapatkan reward!
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 {(Array.isArray(referrals) ? referrals : []).map((referral, index) => {
 const status = getStatusConfig(referral.status);
 return (
 <motion.div
 key={referral.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.03 }}
 className="flex items-center gap-4 md:gap-4 p-2 md:p-4 rounded-xl hover:bg-neutral-50 transition-colors"
 >
 <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
 <Users className="w-5 h-5 text-neutral-600" aria-hidden="true" weight="duotone" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className="font-medium text-black text-sm">{referral.referredUser?.username || 'Tidak diketahui'}</span>
 <Badge className={`${status.bgColor} ${status.color} border-0 text-[10px]`}>
 {status.label}
 </Badge>
 </div>
 <div className="text-xs text-neutral-600">
 Bergabung {formatRelativeTime(referral.createdAt)}
 </div>
 </div>
 <div className="text-right shrink-0">
 <div className="font-semibold text-sm text-emerald-600">
 +{formatCurrency(referral.rewardAmount)}
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 )}
 </>
 )}

 {activeTab === 'rewards' && (
 <>
 {(Array.isArray(rewards) ? rewards : []).length === 0 ? (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
 <Gift className="w-8 h-8 text-neutral-500" aria-hidden="true" weight="regular" />
 </div>
 <h4 className="text-lg font-semibold text-black mb-1">Belum Ada Hadiah</h4>
 <p className="text-sm text-neutral-600 max-w-sm mx-auto">
 Reward Anda akan muncul di sini setelah referral menyelesaikan transaksi pertamanya.
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 {(Array.isArray(rewards) ? rewards : []).map((reward, index) => {
 const status = getStatusConfig(reward.status);
 return (
 <motion.div
 key={reward.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.03 }}
 className="flex items-center gap-4 md:gap-4 p-2 md:p-4 rounded-xl hover:bg-neutral-50 transition-colors"
 >
 <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${status.bgColor}`}>
 <status.icon className={`w-5 h-5 ${status.color}`} weight="duotone" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className="font-medium text-black text-sm">
 {reward.rewardType === 'COMMISSION' ? 'Komisi' : 'Cashback'}
 </span>
 <Badge className={`${status.bgColor} ${status.color} border-0 text-[10px]`}>
 {status.label}
 </Badge>
 </div>
 <div className="text-xs text-neutral-600">
 Dari {reward.referredUser} • {formatRelativeTime(reward.createdAt)}
 </div>
 </div>
 <div className="flex items-center gap-4 shrink-0">
 <div className="font-semibold text-sm text-emerald-600">
 +{formatCurrency(reward.amount)}
 </div>
 {reward.status === 'PENDING' && (
 <Button
 size="sm"
 onClick={() => claimReward(reward.id)}
 disabled={claimingRewardId === reward.id}
 className="bg-black text-white hover:bg-black/90 rounded-lg h-8 text-xs"
 >
 {claimingRewardId === reward.id ? (
 <Spinner className="w-3 h-3 animate-spin" aria-hidden="true" />
 ) : (
 'Klaim'
 )}
 </Button>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 )}
 </>
 )}
 </div>
 </motion.div>

 {/* ========== HOW IT WORKS ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="bg-neutral-50 rounded-2xl p-4 md:p-6 border border-neutral-200"
 >
 <h3 className="font-semibold text-black mb-4">Cara Kerja</h3>
 <div className="grid md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 text-sm font-bold">1</div>
 <div>
 <div className="font-medium text-black text-sm">Bagikan Kode Anda</div>
 <div className="text-xs text-neutral-600">Kirim kode referral unik Anda ke teman</div>
 </div>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 text-sm font-bold">2</div>
 <div>
 <div className="font-medium text-black text-sm">Mereka Mendaftar</div>
 <div className="text-xs text-neutral-600">Teman mendaftar menggunakan kode referral Anda</div>
 </div>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 text-sm font-bold">3</div>
 <div>
 <div className="font-medium text-black text-sm">Keduanya Dapat Reward</div>
 <div className="text-xs text-neutral-600">Kalian berdua mendapat Rp 25.000 setelah transaksi pertama</div>
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 </DashboardLayout>
 );
}
