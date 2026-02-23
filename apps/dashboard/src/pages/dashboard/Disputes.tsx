/**
 * KAHADE DISPUTES PAGE - Professional Responsive Design
 * 
 * Design Philosophy:
 * - Mobile: Card-based list with status indicators
 * - Tablet/Desktop: Full table view with all details
 * - Consistent visual hierarchy across all breakpoints
 */

import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Warning, Clock, CheckCircle, Spinner, CaretRight,
 ChatCircle, Scales, XCircle, ShieldCheck
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Badge } from '@kahade/ui';
import { toast } from 'sonner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { disputeApi } from '@kahade/utils';
import { UnderlineTabsSimple } from '@kahade/ui';

interface Dispute {
 id: string;
 orderId: string;
 order: {
 title: string;
 amount: number;
 };
 reason: string;
 status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
 resolution?: string;
 createdAt: string;
 updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Warning }> = {
 OPEN: { label: 'Open', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Warning },
 UNDER_REVIEW: { label: 'Under Review', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
 RESOLVED: { label: 'Resolved', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: CheckCircle },
 CLOSED: { label: 'Closed', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle },
};

const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0
 }).format(amount);
};

const formatDate = (dateString: string) => {
 return new Date(dateString).toLocaleDateString('en-US', {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 });
};

const formatRelativeTime = (dateString: string) => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffDays < 1) return 'Today';
 if (diffDays < 7) return `${diffDays}d ago`;
 return formatDate(dateString);
};

export default function Disputes() {
 const [disputes, setDisputes] = useState<Dispute[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('all');

 useEffect(() => {
 fetchDisputes();
 }, []);

 const fetchDisputes = async () => {
 try {
 const response = await disputeApi.list({ limit: 50 });
 // Safely extract disputes array
 const data = response?.data;
 let disputeList: Dispute[] = [];
 if (data) {
 if (Array.isArray(data.disputes)) disputeList = data.disputes;
 else if (Array.isArray(data.data)) disputeList = data.data;
 else if (Array.isArray(data)) disputeList = data;
 }
 setDisputes(disputeList);
 } catch (error: unknown) {
 if (error?.response?.status !== 401) {
 toast.error('Failed to load disputes');
 }
 setDisputes([]);
 } finally {
 setIsLoading(false);
 }
 };

 // Ensure disputes is always an array
 const disputeList = Array.isArray(disputes) ? disputes : [];
 
 const filterDisputes = (status?: string) => {
 if (!status || status === 'all') return disputeList;
 if (status === 'resolved') return disputeList.filter(d => d.status === 'RESOLVED' || d.status === 'CLOSED');
 return disputeList.filter(d => d.status === status);
 };

 const stats = {
 total: disputeList.length,
 open: disputeList.filter(d => d.status === 'OPEN').length,
 underReview: disputeList.filter(d => d.status === 'UNDER_REVIEW').length,
 resolved: disputeList.filter(d => d.status === 'RESOLVED' || d.status === 'CLOSED').length,
 };

 const tabs = [
 { id: 'all', label: 'All', count: stats.total },
 { id: 'OPEN', label: 'Open', count: stats.open },
 { id: 'UNDER_REVIEW', label: 'In Review', count: stats.underReview },
 { id: 'resolved', label: 'Resolved', count: stats.resolved },
 ];

 if (isLoading) {
 return (
 <DashboardLayout title="Disputes" subtitle="Loading...">
 <div className="flex items-center justify-center h-64">
 <div className="text-center">
 <Spinner className="w-10 h-10 animate-spin text-black mx-auto mb-4" aria-hidden="true" weight="bold" />
 <p className="text-neutral-600">Loading disputes...</p>
 </div>
 </div>
 </DashboardLayout>
 );
 }

 return (
 <DashboardLayout title="Disputes" subtitle="Manage your transaction disputes">
 <div className="space-y-6">
 {/* ========== STATS CARDS ========== */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-4">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
 <Scales className="w-5 h-5 text-black" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats.total}</div>
 <div className="text-sm text-neutral-600">Total Disputes</div>
 </motion.div>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.05 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
 <Warning className="w-5 h-5 text-amber-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats.open}</div>
 <div className="text-sm text-neutral-600">Open</div>
 </motion.div>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
 <Clock className="w-5 h-5 text-blue-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats.underReview}</div>
 <div className="text-sm text-neutral-600">Under Review</div>
 </motion.div>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
 <CheckCircle className="w-5 h-5 text-emerald-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats.resolved}</div>
 <div className="text-sm text-neutral-600">Resolved</div>
 </motion.div>
 </div>

 {/* ========== DISPUTES LIST ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
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
 {filterDisputes(activeTab).length === 0 ? (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
 <Scales className="w-8 h-8 text-neutral-500" aria-hidden="true" weight="regular" />
 </div>
 <h4 className="text-lg font-semibold text-black mb-1">No Disputes</h4>
 <p className="text-sm text-neutral-600 max-w-sm mx-auto">
 {activeTab === 'all' 
 ? "You don't have any disputes yet. Great job keeping your transactions smooth!" 
 : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} disputes found.`}
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 <AnimatePresence>
 {filterDisputes(activeTab).map((dispute, index) => {
 const status = statusConfig[dispute.status];
 return (
 <motion.div
 key={dispute.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 transition={{ delay: index * 0.03 }}
 >
 <Link href={`/disputes/${dispute.id}`}>
 <div className="flex items-center gap-4 md:gap-4 p-2 md:p-4 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer group">
 {/* Status Icon */}
 <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${status.bgColor}`}>
 <status.icon className={`w-5 h-5 ${status.color}`} weight="duotone" />
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className="font-medium text-black text-sm truncate">{dispute.order.title}</span>
 <Badge className={`${status.bgColor} ${status.color} border-0 text-[10px] shrink-0`}>
 {status.label}
 </Badge>
 </div>
 <div className="flex items-center gap-2 text-xs text-neutral-600">
 <span>{formatCurrency(dispute.order.amount)}</span>
 <span>•</span>
 <span>{formatRelativeTime(dispute.createdAt)}</span>
 </div>
 {dispute.reason && (
 <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{dispute.reason}</p>
 )}
 </div>
 
 {/* Arrow */}
 <CaretRight className="w-5 h-5 text-neutral-300 group-hover:text-neutral-900 transition-colors shrink-0" aria-hidden="true" weight="bold" />
 </div>
 </Link>
 </motion.div>
 );
 })}
 </AnimatePresence>
 </div>
 )}
 </div>
 </motion.div>

 {/* ========== HELP SECTION ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.25 }}
 className="bg-neutral-50 rounded-2xl p-4 md:p-6 border border-neutral-200"
 >
 <div className="flex flex-col md:flex-row md:items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center shrink-0">
 <ChatCircle className="w-6 h-6 text-white" aria-hidden="true" weight="duotone" />
 </div>
 <div className="flex-1">
 <h3 className="font-semibold text-black mb-1">Need Help with a Dispute?</h3>
 <p className="text-sm text-neutral-600">
 Our support team is available 24/7 to help resolve your disputes fairly and quickly.
 </p>
 </div>
 <Link href="/help">
 <Button className="bg-black text-white hover:bg-black/90 rounded-xl h-10 w-full md:w-auto">
 Contact Support
 <CaretRight className="w-4 h-4 ml-1" aria-hidden="true" weight="bold" />
 </Button>
 </Link>
 </div>
 </motion.div>

 {/* ========== INFO CARD ========== */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-6"
 >
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
 <ShieldCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" weight="duotone" />
 </div>
 <div>
 <h3 className="font-semibold text-black mb-1">How Disputes Work</h3>
 <p className="text-sm text-neutral-600 mb-3">
 When a dispute is opened, funds are held securely in escrow while our team reviews the case. Both parties can submit evidence, and we'll work to find a fair resolution within 3-5 business days.
 </p>
 <div className="flex flex-wrap gap-2">
 <Badge className="bg-neutral-100 text-neutral-600 border-0">Secure Escrow</Badge>
 <Badge className="bg-neutral-100 text-neutral-600 border-0">Fair Resolution</Badge>
 <Badge className="bg-neutral-100 text-neutral-600 border-0">24/7 Support</Badge>
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 </DashboardLayout>
 );
}
