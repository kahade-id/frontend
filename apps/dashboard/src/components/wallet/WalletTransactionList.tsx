import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle, Spinner } from '@phosphor-icons/react';
import { Card } from '@kahade/ui';
import { Badge } from '@kahade/ui';

interface WalletTransaction {
 id: string;
 type: string;
 amount: number;
 status: string;
 description: string;
 reference?: string;
 referenceId?: string;
 createdAt: string;
 metadata?: {
 transactionId?: string;
 bankName?: string;
 accountNumber?: string;
 };
}

interface WalletTransactionListProps {
 transactions: WalletTransaction[];
 isLoading: boolean;
}

export function WalletTransactionList({ transactions, isLoading }: WalletTransactionListProps) {
 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount);
 };

 const formatDate = (dateString: string) => {
 const date = new Date(dateString);
 return new Intl.DateTimeFormat('id-ID', {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 }).format(date);
 };

 const getStatusColor = (status: string) => {
 const statusColors: Record<string, string> = {
 'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
 'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
 'PROCESSING': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
 'FAILED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
 'REJECTED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
 };
 return statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'COMPLETED':
 return <CheckCircle className="w-4 h-4" weight="fill" />;
 case 'PENDING':
 case 'PROCESSING':
 return <Clock className="w-4 h-4" weight="fill" />;
 default:
 return <Spinner className="w-4 h-4" />;
 }
 };

 const getTransactionIcon = (type: string) => {
 const isIncoming = ['DEPOSIT', 'TOPUP', 'REFUND', 'TRANSFER_IN'].includes(type);
 return isIncoming ? (
 <ArrowDownRight className="w-5 h-5 text-green-600" weight="bold" />
 ) : (
 <ArrowUpRight className="w-5 h-5 text-red-600" weight="bold" />
 );
 };

 if (isLoading) {
 return (
 <Card className="p-6">
 <div className="animate-pulse space-y-4">
 {[1, 2, 3, 4, 5].map((i) => (
 <div key={i} className="flex items-center gap-4">
 <div className="w-10 h-10 bg-muted rounded-full"></div>
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-muted rounded w-3/4"></div>
 <div className="h-3 bg-muted rounded w-1/2"></div>
 </div>
 <div className="h-4 bg-muted rounded w-20"></div>
 </div>
 ))}
 </div>
 </Card>
 );
 }

 if (transactions.length === 0) {
 return (
 <Card className="p-12 text-center">
 <div className="text-muted-foreground">
 <p className="text-lg font-medium mb-2">Belum ada transaksi</p>
 <p className="text-sm">Transaksi Anda akan muncul di sini</p>
 </div>
 </Card>
 );
 }

 return (
 <Card className="p-4 md:p-6">
 <h3 className="text-lg font-semibold mb-4">Riwayat Transaksi</h3>
 <div className="space-y-3">
 {transactions.map((transaction, index) => (
 <motion.div
 key={transaction.id}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.05 }}
 className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
 >
 <div className="p-2 bg-muted rounded-full">
 {getTransactionIcon(transaction.type)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium truncate">{transaction.description}</p>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-xs text-muted-foreground">
 {formatDate(transaction.createdAt)}
 </p>
 <Badge 
 variant="secondary" 
 className={`text-xs ${getStatusColor(transaction.status)}`}
 >
 <span className="flex items-center gap-1">
 {getStatusIcon(transaction.status)}
 {transaction.status}
 </span>
 </Badge>
 </div>
 </div>
 <div className="text-right">
 <p className={`font-semibold ${
 ['DEPOSIT', 'TOPUP', 'REFUND', 'TRANSFER_IN'].includes(transaction.type)
 ? 'text-green-600'
 : 'text-red-600'
 }`}>
 {['DEPOSIT', 'TOPUP', 'REFUND', 'TRANSFER_IN'].includes(transaction.type) ? '+' : '-'}
 {formatCurrency(transaction.amount)}
 </p>
 </div>
 </motion.div>
 ))}
 </div>
 </Card>
 );
}
