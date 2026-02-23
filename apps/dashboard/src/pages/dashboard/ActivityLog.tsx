/**
 * KAHADE ACTIVITY LOG PAGE - Professional Responsive Design
 * 
 * Design Philosophy:
 * - Mobile: Timeline-based activity list with filters
 * - Tablet/Desktop: Grid layout with stats and detailed activity list
 * - Consistent visual hierarchy across all breakpoints
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 ClockCounterClockwise, SignIn, SignOut, Key, ShieldCheck,
 Wallet, CreditCard, User, Spinner, Warning, CheckCircle,
 DeviceMobile, Globe, Desktop, Phone, CaretRight, Receipt,
 ShoppingCart, Handshake, Clock
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Badge } from '@kahade/ui';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@kahade/ui";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from "@kahade/ui";
import { toast } from 'sonner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { activityApi } from '@kahade/utils';
import { UnderlineTabsSimple } from '@kahade/ui';

interface Activity {
 id: string;
 type: string;
 description: string;
 ipAddress?: string;
 userAgent?: string;
 country?: string;
 city?: string;
 metadata?: Record<string, any>;
 createdAt: string;
}

interface ActivityStats {
 today: number;
 thisWeek: number;
 thisMonth: number;
 total: number;
 lastLogin: string | null;
 loginCountThisMonth: number;
}

const activityConfig: Record<string, { icon: typeof SignIn; color: string; bgColor: string; label: string }> = {
 LOGIN: { icon: SignIn, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Login' },
 LOGOUT: { icon: SignOut, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Logout' },
 PASSWORD_CHANGE: { icon: Key, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Password Changed' },
 PASSWORD_RESET: { icon: Key, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Password Reset' },
 MFA_ENABLED: { icon: ShieldCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: '2FA Enabled' },
 MFA_DISABLED: { icon: ShieldCheck, color: 'text-red-600', bgColor: 'bg-red-50', label: '2FA Disabled' },
 PROFILE_UPDATE: { icon: User, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Profile Updated' },
 PROFILE_UPDATED: { icon: User, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Profile Updated' },
 KYC_SUBMITTED: { icon: ShieldCheck, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'KYC Submitted' },
 KYC_VERIFIED: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'KYC Verified' },
 KYC_REJECTED: { icon: Warning, color: 'text-red-600', bgColor: 'bg-red-50', label: 'KYC Rejected' },
 WALLET_TOPUP: { icon: Wallet, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Wallet Top Up' },
 WALLET_WITHDRAW: { icon: Wallet, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Wallet Withdrawal' },
 BANK_ADDED: { icon: CreditCard, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Bank Added' },
 BANK_REMOVED: { icon: CreditCard, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Bank Removed' },
 ORDER_CREATE: { icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Order Created' },
 ORDER_CREATED: { icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Order Created' },
 ORDER_COMPLETED: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Order Completed' },
 TRANSACTION_CREATED: { icon: Handshake, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Transaction Created' },
 TRANSACTION_UPDATED: { icon: Handshake, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Transaction Updated' },
 PAYMENT_SUCCESS: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Payment Success' },
 DISPUTE_OPENED: { icon: Warning, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Dispute Opened' },
 DISPUTE_RESOLVED: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Dispute Resolved' },
};

const formatDate = (dateString: string) => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMs / 3600000);
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffMins < 1) return 'Just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 if (diffDays < 7) return `${diffDays}d ago`;
 
 return date.toLocaleDateString('en-US', {
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit',
 });
};

const parseUserAgent = (ua?: string) => {
 if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
 
 let device = 'Desktop';
 if (ua.includes('Mobile') || ua.includes('Android')) device = 'Mobile';
 if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';
 
 let browser = 'Unknown';
 if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
 else if (ua.includes('Firefox')) browser = 'Firefox';
 else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
 else if (ua.includes('Edge')) browser = 'Edge';
 
 let os = 'Unknown';
 if (ua.includes('Windows')) os = 'Windows';
 else if (ua.includes('Mac')) os = 'macOS';
 else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
 else if (ua.includes('Android')) os = 'Android';
 else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';
 
 return { device, browser, os };
};

const getDeviceIcon = (device: string) => {
 switch (device) {
 case 'Mobile': return Phone;
 case 'Tablet': return DeviceMobile;
 default: return Desktop;
 }
};

const tabs = [
 { id: 'all', label: 'All Activity' },
 { id: 'security', label: 'Security' },
 { id: 'wallet', label: 'Wallet' },
 { id: 'orders', label: 'Orders' },
];

export default function ActivityLog() {
 const [activities, setActivities] = useState<Activity[]>([]);
 const [stats, setStats] = useState<ActivityStats | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [activeTab, setActiveTab] = useState('all');
 const [filter, setFilter] = useState('all');
 const [page, setPage] = useState(1);
 const [hasMore, setHasMore] = useState(true);
 const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
 const [isDetailOpen, setIsDetailOpen] = useState(false);
 const [isLoadingMore, setIsLoadingMore] = useState(false);

 useEffect(() => {
 fetchAllData();
 }, []);

 useEffect(() => {
 if (activeTab === 'all') {
 fetchActivities();
 } else if (activeTab === 'security') {
 fetchSecurityActivities();
 } else if (activeTab === 'wallet') {
 fetchWalletActivities();
 } else if (activeTab === 'orders') {
 fetchOrderActivities();
 }
 }, [activeTab, filter]);

 const fetchAllData = async () => {
 try {
 const [activitiesRes, statsRes] = await Promise.all([
 activityApi.list({ limit: 20 }),
 activityApi.getStats(),
 ]);

 // Safely extract activities array
 const actData = activitiesRes?.data;
 let actList: Activity[] = [];
 if (actData) {
 if (Array.isArray(actData.data)) actList = actData.data;
 else if (Array.isArray(actData.activities)) actList = actData.activities;
 else if (Array.isArray(actData)) actList = actData;
 }
 setActivities(actList);
 setStats(statsRes?.data || null);
 setHasMore(actList.length === 20);
 } catch (error: unknown) {
 if (error?.response?.status !== 401) {
 toast.error('Failed to load activity log');
 }
 setActivities([]);
 } finally {
 setIsLoading(false);
 }
 };

 const fetchActivities = async (loadMore = false) => {
 try {
 if (loadMore) setIsLoadingMore(true);
 const currentPage = loadMore ? page + 1 : 1;
 const params: Record<string, unknown> = { page: currentPage, limit: 20 };
 if (filter !== 'all') params.type = filter;

 const response = await activityApi.list(params);
 
 // Safely extract activities array
 const actData = response?.data;
 let newActivities: Activity[] = [];
 if (actData) {
 if (Array.isArray(actData.data)) newActivities = actData.data;
 else if (Array.isArray(actData.activities)) newActivities = actData.activities;
 else if (Array.isArray(actData)) newActivities = actData;
 }
 
 if (loadMore) {
 const currentActivities = Array.isArray(activities) ? activities : [];
 setActivities([...currentActivities, ...newActivities]);
 setPage(currentPage);
 } else {
 setActivities(newActivities);
 setPage(1);
 }
 
 setHasMore(newActivities.length === 20);
 } catch (error) {
 if (!loadMore) setActivities([]);
 } finally {
 setIsLoadingMore(false);
 }
 };

 const fetchSecurityActivities = async () => {
 try {
 const response = await activityApi.getSecurity({ limit: 20 });
 const actData = response?.data;
 let actList: Activity[] = [];
 if (actData) {
 if (Array.isArray(actData.data)) actList = actData.data;
 else if (Array.isArray(actData)) actList = actData;
 }
 setActivities(actList);
 } catch (error) {
 setActivities([]);
 }
 };

 const fetchWalletActivities = async () => {
 try {
 const response = await activityApi.getWallet({ limit: 20 });
 const actData = response?.data;
 let actList: Activity[] = [];
 if (actData) {
 if (Array.isArray(actData.data)) actList = actData.data;
 else if (Array.isArray(actData)) actList = actData;
 }
 setActivities(actList);
 } catch (error) {
 setActivities([]);
 }
 };

 const fetchOrderActivities = async () => {
 try {
 const response = await activityApi.getTransactions({ limit: 20 });
 const actData = response?.data;
 let actList: Activity[] = [];
 if (actData) {
 if (Array.isArray(actData.data)) actList = actData.data;
 else if (Array.isArray(actData)) actList = actData;
 }
 setActivities(actList);
 } catch (error) {
 setActivities([]);
 }
 };

 const handleViewDetail = (activity: Activity) => {
 setSelectedActivity(activity);
 setIsDetailOpen(true);
 };

 if (isLoading) {
 return (
 <DashboardLayout title="Activity Log" subtitle="Loading...">
 <div className="flex items-center justify-center h-64">
 <div className="text-center">
 <Spinner className="w-10 h-10 animate-spin text-black mx-auto mb-4" aria-hidden="true" weight="bold" />
 <p className="text-neutral-600">Loading activity log...</p>
 </div>
 </div>
 </DashboardLayout>
 );
 }

 return (
 <DashboardLayout title="Activity Log" subtitle="View your account activity">
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
 <Clock className="w-5 h-5 text-black" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.today || 0}</div>
 <div className="text-sm text-neutral-600">Today</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.05 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
 <ClockCounterClockwise className="w-5 h-5 text-blue-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.thisWeek || 0}</div>
 <div className="text-sm text-neutral-600">This Week</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
 <SignIn className="w-5 h-5 text-emerald-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.loginCountThisMonth || 0}</div>
 <div className="text-sm text-neutral-600">Logins This Month</div>
 </motion.div>

 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-5"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
 <Receipt className="w-5 h-5 text-purple-600" aria-hidden="true" weight="duotone" />
 </div>
 </div>
 <div className="text-2xl font-bold text-black">{stats?.total || 0}</div>
 <div className="text-sm text-neutral-600">Total Activities</div>
 </motion.div>
 </div>

 {/* ========== ACTIVITY LIST ========== */}
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

 {/* Filter (for All Activity tab) */}
 {activeTab === 'all' && (
 <div className="p-4 md:px-5 border-b border-neutral-200 bg-neutral-50">
 <Select value={filter} onValueChange={setFilter}>
 <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl border-neutral-200 bg-white" aria-hidden="true">
 <SelectValue placeholder="Filter by type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Types</SelectItem>
 <SelectItem value="LOGIN">Login</SelectItem>
 <SelectItem value="LOGOUT">Logout</SelectItem>
 <SelectItem value="PASSWORD_CHANGE">Password Change</SelectItem>
 <SelectItem value="PROFILE_UPDATE">Profile Update</SelectItem>
 <SelectItem value="WALLET_TOPUP">Wallet Top Up</SelectItem>
 <SelectItem value="WALLET_WITHDRAW">Withdrawal</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Activity List */}
 <div className="divide-y divide-neutral-200">
 {(Array.isArray(activities) ? activities : []).length === 0 ? (
 <div className="p-12 text-center">
 <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
 <ClockCounterClockwise className="w-8 h-8 text-neutral-500" aria-hidden="true" weight="regular" />
 </div>
 <h3 className="font-semibold text-black mb-1">No Activity</h3>
 <p className="text-sm text-neutral-600">Your activity will appear here</p>
 </div>
 ) : (
 <AnimatePresence>
 {(Array.isArray(activities) ? activities : []).map((activity, index) => {
 const config = activityConfig[activity.type] || {
 icon: ClockCounterClockwise,
 color: 'text-gray-600',
 bgColor: 'bg-gray-100',
 label: activity.type
 };
 const Icon = config.icon;
 const { device, browser, os } = parseUserAgent(activity.userAgent);
 const DeviceIcon = getDeviceIcon(device);

 return (
 <motion.div
 key={activity.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.02 }}
 onClick={() => handleViewDetail(activity)}
 className="flex items-center gap-4 md:gap-4 p-4 md:px-5 hover:bg-neutral-50 transition-colors cursor-pointer group"
 >
 {/* Icon */}
 <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${config.bgColor}`}>
 <Icon className={`w-5 h-5 ${config.color}`} weight="duotone" />
 </div>
 
 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <span className="font-medium text-black text-sm">{config.label}</span>
 </div>
 <div className="text-xs text-neutral-600 line-clamp-1">
 {activity.description}
 </div>
 {activity.ipAddress && (
 <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
 <DeviceIcon className="w-3 h-3" aria-hidden="true" />
 <span>{browser} on {os}</span>
 <span>•</span>
 <Globe className="w-3 h-3" aria-hidden="true" />
 <span>{activity.ipAddress}</span>
 </div>
 )}
 </div>
 
 {/* Time & Arrow */}
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-xs text-neutral-500">{formatDate(activity.createdAt)}</span>
 <CaretRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" aria-hidden="true" weight="bold" />
 </div>
 </motion.div>
 );
 })}
 </AnimatePresence>
 )}
 </div>

 {/* Load More */}
 {hasMore && (Array.isArray(activities) ? activities : []).length > 0 && (
 <div className="p-4 md:p-5 border-t border-neutral-200 bg-neutral-50">
 <Button
 variant="outline"
 onClick={() => fetchActivities(true)}
 disabled={isLoadingMore}
 className="w-full rounded-xl border-neutral-200 h-10"
 >
 {isLoadingMore ? (
 <>
 <Spinner className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
 Loading...
 </>
 ) : (
 'Load More'
 )}
 </Button>
 </div>
 )}
 </motion.div>
 </div>

 {/* ========== ACTIVITY DETAIL DIALOG ========== */}
 <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>Activity Details</DialogTitle>
 <DialogDescription>
 Full details of this activity
 </DialogDescription>
 </DialogHeader>
 
 {selectedActivity && (
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 {(() => {
 const config = activityConfig[selectedActivity.type] || {
 icon: ClockCounterClockwise,
 color: 'text-gray-600',
 bgColor: 'bg-gray-100',
 label: selectedActivity.type
 };
 const Icon = config.icon;
 return (
 <>
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bgColor}`}>
 <Icon className={`w-6 h-6 ${config.color}`} weight="duotone" />
 </div>
 <div>
 <div className="font-semibold text-black">{config.label}</div>
 <div className="text-sm text-neutral-600">{formatDate(selectedActivity.createdAt)}</div>
 </div>
 </>
 );
 })()}
 </div>

 <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
 <div>
 <div className="text-xs text-neutral-600 mb-1">Description</div>
 <div className="text-sm text-black">{selectedActivity.description}</div>
 </div>
 
 {selectedActivity.ipAddress && (
 <div>
 <div className="text-xs text-neutral-600 mb-1">IP Address</div>
 <div className="text-sm text-black">{selectedActivity.ipAddress}</div>
 </div>
 )}
 
 {selectedActivity.userAgent && (
 <div>
 <div className="text-xs text-neutral-600 mb-1">Device</div>
 <div className="text-sm text-black">
 {(() => {
 const { device, browser, os } = parseUserAgent(selectedActivity.userAgent);
 return `${browser} on ${os} (${device})`;
 })()}
 </div>
 </div>
 )}
 
 {(selectedActivity.city || selectedActivity.country) && (
 <div>
 <div className="text-xs text-neutral-600 mb-1">Location</div>
 <div className="text-sm text-black">
 {[selectedActivity.city, selectedActivity.country].filter(Boolean).join(', ')}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </DashboardLayout>
 );
}
