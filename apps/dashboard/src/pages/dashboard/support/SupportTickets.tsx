import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@kahade/utils";
// Date formatting utility
const formatDistanceToNow = (date: Date): string => {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMs / 3600000);
 const diffDays = Math.floor(diffMs / 86400000);
 
 if (diffMins < 1) return 'just now';
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 if (diffDays < 7) return `${diffDays}d ago`;
 return date.toLocaleDateString();
};
import {
 Ticket,
 Plus,
 Search,
 Filter,
 Clock,
 CheckCircle,
 AlertCircle,
 XCircle,
 ChevronRight,
 MessageSquare,
} from "lucide-react";

interface SupportTicket {
 id: string;
 ticketNumber: string;
 subject: string;
 description: string;
 category: string;
 priority: string;
 status: string;
 responseCount: number;
 lastResponseAt: string | null;
 createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
 OPEN: { label: "Menunggu", color: "bg-yellow-100 text-yellow-800", icon: Clock },
 IN_PROGRESS: { label: "Diproses", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
 WAITING_CUSTOMER: { label: "Menunggu Balasan", color: "bg-orange-100 text-orange-800", icon: MessageSquare },
 RESOLVED: { label: "Selesai", color: "bg-green-100 text-green-800", icon: CheckCircle },
 CLOSED: { label: "Ditutup", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
 LOW: { label: "Rendah", color: "bg-gray-100 text-gray-600" },
 MEDIUM: { label: "Sedang", color: "bg-blue-100 text-blue-600" },
 HIGH: { label: "Tinggi", color: "bg-orange-100 text-orange-600" },
 URGENT: { label: "Urgent", color: "bg-red-100 text-red-600" },
 CRITICAL: { label: "Kritis", color: "bg-red-200 text-red-800" },
};

const CATEGORY_LABELS: Record<string, string> = {
 GENERAL_INQUIRY: "Pertanyaan Umum",
 ACCOUNT_ISSUE: "Masalah Akun",
 TRANSACTION_ISSUE: "Masalah Transaksi",
 PAYMENT_ISSUE: "Masalah Pembayaran",
 WITHDRAWAL_ISSUE: "Masalah Penarikan",
 KYC_VERIFICATION: "Verifikasi KYC",
 DISPUTE_HELP: "Bantuan Sengketa",
 SECURITY_CONCERN: "Keamanan",
 BUG_REPORT: "Laporan Bug",
 FEATURE_REQUEST: "Permintaan Fitur",
 REFUND_REQUEST: "Permintaan Refund",
 OTHER: "Lainnya",
};

export default function SupportTickets() {
 const [, navigate] = useLocation();
 const [tickets, setTickets] = useState<SupportTicket[]>([]);
 const [loading, setLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState<string>("");
 const [searchQuery, setSearchQuery] = useState("");
 const [showCreateModal, setShowCreateModal] = useState(false);

 useEffect(() => {
 loadTickets();
 }, [statusFilter]);

 const loadTickets = async () => {
 try {
 setLoading(true);
 const params = new URLSearchParams();
 if (statusFilter) params.append("status", statusFilter);
 const response = await api.get(`/support/tickets/my?${params.toString()}`);
 setTickets(response.data.data || []);
 } catch (error) {
 } finally {
 setLoading(false);
 }
 };

 const filteredTickets = tickets.filter((ticket) => {
 if (!searchQuery) return true;
 return (
 ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
 ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())
 );
 });

 return (
 <div className="max-w-6xl mx-auto px-4 py-8">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
 <div>
 <h1 className="text-2xl font-bold text-gray-900">Tiket Dukungan</h1>
 <p className="text-gray-500 mt-1">Kelola permintaan bantuan Anda</p>
 </div>
 <button
 onClick={() => setShowCreateModal(true)}
 className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
 >
 <Plus className="h-5 w-5" aria-hidden="true" />
 <span>Buat Tiket Baru</span>
 </button>
 </div>

 {/* Filters */}
 <div className="bg-white rounded-xl border p-4 mb-6">
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
 <input
 type="text"
 placeholder="Cari tiket..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
 />
 </div>
 <div className="flex items-center gap-2">
 <Filter className="h-5 w-5 text-gray-400" aria-hidden="true" />
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
 >
 <option value="">Semua Status</option>
 <option value="OPEN">Menunggu</option>
 <option value="IN_PROGRESS">Diproses</option>
 <option value="WAITING_CUSTOMER">Menunggu Balasan</option>
 <option value="RESOLVED">Selesai</option>
 <option value="CLOSED">Ditutup</option>
 </select>
 </div>
 </div>
 </div>

 {/* Ticket List */}
 {loading ? (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 ) : filteredTickets.length === 0 ? (
 <div className="bg-white rounded-xl border p-12 text-center">
 <Ticket className="h-16 w-16 text-gray-300 mx-auto mb-4" aria-hidden="true" />
 <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada tiket</h3>
 <p className="text-gray-500 mb-6">
 Buat tiket baru jika Anda memerlukan bantuan
 </p>
 <button
 onClick={() => setShowCreateModal(true)}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
 >
 <Plus className="h-5 w-5" aria-hidden="true" />
 <span>Buat Tiket Baru</span>
 </button>
 </div>
 ) : (
 <div className="space-y-4">
 {filteredTickets.map((ticket) => {
 const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
 const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
 const StatusIcon = statusConfig.icon;

 return (
 <div
 key={ticket.id}
 onClick={() => navigate(`/dashboard/support/${ticket.id}`)}
 className="bg-white rounded-xl border p-6 transition-shadow cursor-pointer"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-4 mb-2">
 <span className="text-sm font-mono text-gray-500">
 {ticket.ticketNumber}
 </span>
 <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
 <StatusIcon className="inline h-3 w-3 mr-1" aria-hidden="true" />
 {statusConfig.label}
 </span>
 <span className={`px-2 py-0.5 text-xs rounded-full ${priorityConfig.color}`}>
 {priorityConfig.label}
 </span>
 </div>
 <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
 {ticket.subject}
 </h3>
 <p className="text-gray-500 text-sm line-clamp-2 mb-3">
 {ticket.description}
 </p>
 <div className="flex items-center gap-4 text-sm text-gray-500">
 <span className="flex items-center gap-1">
 <Ticket className="h-4 w-4" aria-hidden="true" />
 {CATEGORY_LABELS[ticket.category] || ticket.category}
 </span>
 <span className="flex items-center gap-1">
 <MessageSquare className="h-4 w-4" aria-hidden="true" />
 {ticket.responseCount} balasan
 </span>
 <span className="flex items-center gap-1">
 <Clock className="h-4 w-4" aria-hidden="true" />
 {formatDistanceToNow(new Date(ticket.createdAt))}
 </span>
 </div>
 </div>
 <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Create Ticket Modal */}
 {showCreateModal && (
 <CreateTicketModal
 onClose={() => setShowCreateModal(false)}
 onCreated={() => {
 setShowCreateModal(false);
 loadTickets();
 }}
 />
 )}
 </div>
 );
}

// Create Ticket Modal Component
function CreateTicketModal({
 onClose,
 onCreated,
}: {
 onClose: () => void;
 onCreated: () => void;
}) {
 const [formData, setFormData] = useState({
 subject: "",
 description: "",
 category: "GENERAL_INQUIRY",
 priority: "MEDIUM",
 });
 const [submitting, setSubmitting] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);

 try {
 await api.post("/support/tickets", formData);
 onCreated();
 } catch (error) {
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b">
 <h2 className="text-xl font-semibold">Buat Tiket Baru</h2>
 </div>
 <form onSubmit={handleSubmit} className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Kategori
 </label>
 <select
 value={formData.category}
 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
 className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
 >
 {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
 <option key={value} value={value}>
 {label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Prioritas
 </label>
 <select
 value={formData.priority}
 onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
 className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
 >
 <option value="LOW">Rendah</option>
 <option value="MEDIUM">Sedang</option>
 <option value="HIGH">Tinggi</option>
 <option value="URGENT">Urgent</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Subjek
 </label>
 <input
 type="text"
 value={formData.subject}
 onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
 placeholder="Ringkasan masalah Anda"
 required
 className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Deskripsi
 </label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Jelaskan masalah Anda secara detail..."
 required
 rows={5}
 className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
 />
 </div>
 <div className="flex gap-4 pt-4">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
 >
 Batal
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
 >
 {submitting ? "Mengirim..." : "Kirim Tiket"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
