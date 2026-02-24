/**
 * KAHADE DISPUTE DETAIL PAGE - Professional Responsive Design
 * 
 * Design Philosophy:
 * - Mobile: Stacked cards with chat interface
 * - Tablet/Desktop: Two-column layout with sidebar info
 * - Consistent visual hierarchy across all breakpoints
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
 ArrowLeft, Warning, Clock, CheckCircle, Spinner,
 ChatCircle, PaperPlaneTilt, XCircle, User, ShieldCheck
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { Badge } from '@kahade/ui';
import { toast } from 'sonner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { disputeApi } from '@kahade/utils';
import { useAuth } from '../../contexts/AuthContext';

interface DisputeMessage {
 id: string;
 senderId: string;
 senderType: 'USER' | 'ADMIN';
 senderName: string;
 content: string;
 attachments?: string[];
 createdAt: string;
}

interface DisputeDetail {
 id: string;
 orderId: string;
 order: {
 id: string;
 title: string;
 amount: number;
 status: string;
 };
 initiatorId: string;
 initiator: {
 username: string;
 };
 reason: string;
 description: string;
 status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
 resolution?: string;
 resolutionNotes?: string;
 messages: DisputeMessage[];
 createdAt: string;
 updatedAt: string;
 resolvedAt?: string;
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
 hour: '2-digit',
 minute: '2-digit',
 });
};

const formatRelativeTime = (dateString: string) => {
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
 return formatDate(dateString);
};

export default function DisputeDetail() {
 const { id } = useParams<{ id: string }>();
 const [, setLocation] = useLocation();
 const { user } = useAuth();
 const [dispute, setDispute] = useState<DisputeDetail | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [message, setMessage] = useState('');
 const [isSending, setIsSending] = useState(false);
 const messagesEndRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (id) fetchDispute();
 }, [id]);

 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [dispute?.messages]);

 const fetchDispute = async () => {
 try {
 const response = await disputeApi.get(id!);
 setDispute(response.data);
 } catch (error) {
 toast.error('Failed to load dispute details');
 } finally {
 setIsLoading(false);
 }
 };

 const handleSendMessage = async () => {
 if (!message.trim()) return;

 setIsSending(true);
 try {
 await disputeApi.sendMessage(id!, message);
 toast.success('Message sent');
 setMessage('');
 fetchDispute();
 } catch (error: unknown) {
 toast.error(error.response?.data?.message || 'Failed to send message');
 } finally {
 setIsSending(false);
 }
 };

 if (isLoading) {
 return (
 <DashboardLayout title="Dispute Details" subtitle="Loading...">
 <div className="flex items-center justify-center h-64">
 <div className="text-center">
 <Spinner className="w-10 h-10 animate-spin text-black mx-auto mb-4" aria-hidden="true" weight="bold" />
 <p className="text-neutral-600">Loading dispute details...</p>
 </div>
 </div>
 </DashboardLayout>
 );
 }

 if (!dispute) {
 return (
 <DashboardLayout title="Dispute Details" subtitle="Not found">
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
 <Warning className="w-8 h-8 text-neutral-500" aria-hidden="true" weight="regular" />
 </div>
 <h3 className="font-semibold text-black mb-1">Dispute Not Found</h3>
 <p className="text-sm text-neutral-600 mb-4">The dispute you're looking for doesn't exist.</p>
 <Link href="/disputes">
 <Button className="bg-black text-white hover:bg-black/90 rounded-xl">
 Back to Disputes
 </Button>
 </Link>
 </div>
 </DashboardLayout>
 );
 }

 const status = statusConfig[dispute.status];
 const StatusIcon = status.icon;

 return (
 <DashboardLayout title="Dispute Details" subtitle={`#${dispute.id.slice(0, 8)}`}>
 <div className="space-y-6">
 {/* Back Button */}
 <Link href="/disputes">
 <Button variant="ghost" className="gap-2 rounded-xl h-10 px-3">
 <ArrowLeft className="w-4 h-4" aria-hidden="true" weight="bold" />
 Back
 </Button>
 </Link>

 <div className="grid lg:grid-cols-3 gap-6">
 {/* Main Content */}
 <div className="lg:col-span-2 space-y-4">
 {/* Dispute Header */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-6"
 >
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
 <div>
 <h2 className="text-lg md:text-xl font-bold text-black mb-1">{dispute.order.title}</h2>
 <p className="text-neutral-600">{formatCurrency(dispute.order.amount)}</p>
 </div>
 <Badge className={`${status.bgColor} ${status.color} border-0 flex items-center gap-1.5 shrink-0`}>
 <StatusIcon className="w-4 h-4" aria-hidden="true" weight="fill" />
 {status.label}
 </Badge>
 </div>

 <div className="space-y-4">
 <div>
 <h4 className="text-xs font-medium text-neutral-600 mb-1">Reason</h4>
 <p className="text-sm text-black">{dispute.reason}</p>
 </div>
 <div>
 <h4 className="text-xs font-medium text-neutral-600 mb-1">Description</h4>
 <p className="text-sm text-black whitespace-pre-wrap">{dispute.description}</p>
 </div>
 </div>
 </motion.div>

 {/* Resolution (if resolved) */}
 {dispute.status === 'RESOLVED' && dispute.resolutionNotes && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5"
 >
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
 <CheckCircle className="w-5 h-5 text-emerald-600" aria-hidden="true" weight="fill" />
 </div>
 <div>
 <h3 className="font-semibold text-emerald-800 mb-1">Resolution</h3>
 <p className="text-sm text-emerald-700">{dispute.resolutionNotes}</p>
 <p className="text-xs text-emerald-600 mt-2">
 Resolved on {formatDate(dispute.resolvedAt!)}
 </p>
 </div>
 </div>
 </motion.div>
 )}

 {/* Messages */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
 >
 <div className="p-4 md:px-5 border-b border-neutral-200">
 <h3 className="font-semibold text-black flex items-center gap-2">
 <ChatCircle className="w-5 h-5" aria-hidden="true" weight="duotone" />
 Messages
 </h3>
 </div>

 <div className="h-80 overflow-y-auto p-4 space-y-3">
 {(Array.isArray(dispute?.messages) ? dispute.messages : []).length === 0 ? (
 <div className="h-full flex items-center justify-center">
 <div className="text-center">
 <ChatCircle className="w-10 h-10 text-neutral-300 mx-auto mb-2" aria-hidden="true" weight="regular" />
 <p className="text-sm text-neutral-600">No messages yet</p>
 </div>
 </div>
 ) : (
 (Array.isArray(dispute?.messages) ? dispute.messages : []).map((msg) => {
 const isOwn = msg.senderId === user?.id;
 const isAdmin = msg.senderType === 'ADMIN';
 
 return (
 <div
 key={msg.id}
 className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
 >
 <div className={`max-w-[80%]`}>
 <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
 {isAdmin ? (
 <ShieldCheck className="w-3 h-3 text-blue-600" aria-hidden="true" weight="fill" />
 ) : (
 <User className="w-3 h-3 text-neutral-500" aria-hidden="true" weight="fill" />
 )}
 <span className={`text-xs font-medium ${isAdmin ? 'text-blue-600' : 'text-neutral-600'}`}>
 {msg.senderName}
 </span>
 </div>
 <div className={`px-4 py-2.5 rounded-2xl ${
 isOwn 
 ? 'bg-black text-white rounded-br-md' 
 : isAdmin 
 ? 'bg-blue-50 text-blue-900 rounded-bl-md' 
 : 'bg-neutral-100 text-black rounded-bl-md'
 }`}>
 <p className="text-sm">{msg.content}</p>
 </div>
 <div className={`text-[10px] text-neutral-500 mt-1 ${isOwn ? 'text-right' : ''}`}>
 {formatRelativeTime(msg.createdAt)}
 </div>
 </div>
 </div>
 );
 })
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Message Input */}
 {(dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW') && (
 <div className="p-4 border-t border-neutral-200 bg-neutral-50">
 <div className="flex gap-2">
 <Input
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Tulis pesan Anda..."
 className="flex-1 h-10 rounded-xl border-neutral-200"
 onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
 />
 <Button
 onClick={handleSendMessage}
 disabled={!message.trim() || isSending}
 className="bg-black text-white hover:bg-black/90 rounded-xl h-10 w-10 p-0"
 >
 {isSending ? (
 <Spinner className="w-4 h-4 animate-spin" aria-hidden="true" />
 ) : (
 <PaperPlaneTilt className="w-4 h-4" aria-hidden="true" weight="fill" />
 )}
 </Button>
 </div>
 </div>
 )}
 </motion.div>
 </div>

 {/* Sidebar */}
 <div className="space-y-4">
 {/* Dispute Info */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3 }}
 className="bg-white rounded-2xl border border-neutral-200 p-5"
 >
 <h3 className="font-semibold text-black mb-4">Dispute Information</h3>
 <div className="space-y-4">
 <div>
 <div className="text-xs text-neutral-600 mb-1">Dispute ID</div>
 <div className="text-sm font-mono text-black">{dispute.id.slice(0, 8)}</div>
 </div>
 <div>
 <div className="text-xs text-neutral-600 mb-1">Order ID</div>
 <Link href={`/app/transactions/${dispute.orderId}`}>
 <span className="text-sm font-mono text-black hover:underline cursor-pointer">
 {dispute.orderId.slice(0, 8)}
 </span>
 </Link>
 </div>
 <div>
 <div className="text-xs text-neutral-600 mb-1">Opened By</div>
 <div className="text-sm text-black">{dispute.initiator.username}</div>
 </div>
 <div>
 <div className="text-xs text-neutral-600 mb-1">Created</div>
 <div className="text-sm text-black">{formatDate(dispute.createdAt)}</div>
 </div>
 <div>
 <div className="text-xs text-neutral-600 mb-1">Last Updated</div>
 <div className="text-sm text-black">{formatRelativeTime(dispute.updatedAt)}</div>
 </div>
 </div>
 </motion.div>

 {/* Help Card */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 }}
 className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200"
 >
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
 <ShieldCheck className="w-5 h-5 text-blue-600" aria-hidden="true" weight="duotone" />
 </div>
 <div>
 <h3 className="font-medium text-black text-sm mb-1">Support Team</h3>
 <p className="text-xs text-neutral-600">
 Our team typically responds within 24 hours. Please provide all relevant details to help us resolve your dispute faster.
 </p>
 </div>
 </div>
 </motion.div>

 {/* Timeline */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.5 }}
 className="bg-white rounded-2xl border border-neutral-200 p-5"
 >
 <h3 className="font-semibold text-black mb-4">Timeline</h3>
 <div className="space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
 <div>
 <div className="text-sm font-medium text-black">Dispute Opened</div>
 <div className="text-xs text-neutral-600">{formatDate(dispute.createdAt)}</div>
 </div>
 </div>
 {dispute.status === 'UNDER_REVIEW' && (
 <div className="flex items-start gap-3">
 <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
 <div>
 <div className="text-sm font-medium text-black">Under Review</div>
 <div className="text-xs text-neutral-600">Team is reviewing</div>
 </div>
 </div>
 )}
 {dispute.resolvedAt && (
 <div className="flex items-start gap-3">
 <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
 <div>
 <div className="text-sm font-medium text-black">Resolved</div>
 <div className="text-xs text-neutral-600">{formatDate(dispute.resolvedAt)}</div>
 </div>
 </div>
 )}
 </div>
 </motion.div>
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}
