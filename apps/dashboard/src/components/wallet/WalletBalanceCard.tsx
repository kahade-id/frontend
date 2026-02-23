import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeSlash, WalletIcon } from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Card } from '@kahade/ui';

interface WalletBalance {
 available: number;
 locked: number;
 total: number;
 currency: string;
}

interface WalletBalanceCardProps {
 balance: WalletBalance | null;
 isLoading: boolean;
 onDeposit: () => void;
 onWithdraw: () => void;
 onTransfer: () => void;
}

export function WalletBalanceCard({ 
 balance, 
 isLoading, 
 onDeposit, 
 onWithdraw, 
 onTransfer 
}: WalletBalanceCardProps) {
 const [showBalance, setShowBalance] = useState(true);

 const formatCurrency = (amount: number) => {
 if (!showBalance) return 'Rp ••••••';
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount);
 };

 if (isLoading) {
 return (
 <Card className="p-6">
 <div className="animate-pulse space-y-4">
 <div className="h-4 bg-muted rounded w-1/3"></div>
 <div className="h-8 bg-muted rounded w-2/3"></div>
 <div className="grid grid-cols-3 gap-2">
 <div className="h-10 bg-muted rounded"></div>
 <div className="h-10 bg-muted rounded"></div>
 <div className="h-10 bg-muted rounded"></div>
 </div>
 </div>
 </Card>
 );
 }

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-6 md:p-8 "
 >
 <div className="flex items-start justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
 <WalletIcon className="w-6 h-6" weight="duotone" />
 </div>
 <div>
 <p className="text-sm opacity-90 font-medium">Saldo Dompet</p>
 <h2 className="text-3xl md:text-4xl font-bold mt-1">
 {formatCurrency(balance?.available || 0)}
 </h2>
 </div>
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => setShowBalance(!showBalance)}
 className="text-primary-foreground hover:bg-white/20"
 aria-label={showBalance ? "Sembunyikan saldo" : "Tampilkan saldo"}
 >
 {showBalance ? (
 <Eye className="w-5 h-5" weight="bold" />
 ) : (
 <EyeSlash className="w-5 h-5" weight="bold" />
 )}
 </Button>
 </div>

 {balance && balance.locked > 0 && (
 <div className="mb-6 p-3 bg-white/10 rounded-lg backdrop-blur-sm">
 <p className="text-xs opacity-80 mb-1">Saldo Dikunci</p>
 <p className="text-lg font-semibold">
 {formatCurrency(balance.locked)}
 </p>
 </div>
 )}

 <div className="grid grid-cols-3 gap-2 md:gap-3">
 <Button
 onClick={onDeposit}
 variant="secondary"
 className="flex-col h-auto py-3 gap-1"
 aria-label="Deposit dana"
 >
 <span className="text-lg">💰</span>
 <span className="text-xs font-medium">Deposit</span>
 </Button>
 <Button
 onClick={onWithdraw}
 variant="secondary"
 className="flex-col h-auto py-3 gap-1"
 aria-label="Tarik dana"
 >
 <span className="text-lg">🏧</span>
 <span className="text-xs font-medium">Tarik</span>
 </Button>
 <Button
 onClick={onTransfer}
 variant="secondary"
 className="flex-col h-auto py-3 gap-1"
 aria-label="Transfer dana"
 >
 <span className="text-lg">💸</span>
 <span className="text-xs font-medium">Transfer</span>
 </Button>
 </div>
 </motion.div>
 );
}
