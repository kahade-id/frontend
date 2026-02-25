/**
 * KAHADE DEPOSIT/TOP UP PAGE - Professional Mobile-First Design
 * 
 * Design Philosophy:
 * - Mobile-first design with clean payment method selection
 * - Similar to popular Indonesian payment apps
 * - Integrated with Xendit API for payment processing
 * - Support for QRIS, E-Wallets, and Bank Transfer
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Spinner, Check, Copy, Warning, Clock, QrCode,
 ArrowRight, Info
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { Label } from '@kahade/ui';
import { cn } from '@kahade/utils';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { walletApi } from '@kahade/utils';
import { toast } from 'sonner';

// Payment method configuration with Xendit codes
interface PaymentMethod {
 id: string;
 name: string;
 code: string;
 logo: string;
 description?: string;
 type: 'ewallet' | 'qris' | 'va';
 minAmount?: number;
 maxAmount?: number;
}

const paymentMethods: PaymentMethod[] = [
 {
 id: 'qris',
 name: 'QRIS',
 code: 'qris',
 logo: '/images/payment-methods/qris.webp',
 description: 'Scan dengan semua e-wallet & mobile banking',
 type: 'qris',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'dana',
 name: 'DANA',
 code: 'ewallet_dana',
 logo: '/images/payment-methods/dana.png',
 type: 'ewallet',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'gopay',
 name: 'GoPay',
 code: 'ewallet_gopay',
 logo: '/images/payment-methods/gopay.png',
 description: 'didukung oleh Midtrans, Inc',
 type: 'ewallet',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'bank_transfer',
 name: 'Bank Transfer',
 code: 'bank_transfer',
 logo: '/images/payment-methods/bank-transfer.jpg',
 description: 'Mandiri/BNI/BRI/Permata/CIMB Niaga & bank lainnya',
 type: 'va',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'ovo',
 name: 'OVO',
 code: 'ewallet_ovo',
 logo: '/images/payment-methods/ovo.png',
 type: 'ewallet',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'shopeepay',
 name: 'Shopee Pay',
 code: 'ewallet_shopeepay',
 logo: '/images/payment-methods/shopeepay.png',
 type: 'ewallet',
 minAmount: 10000,
 maxAmount: 100000000,
 },
 {
 id: 'linkaja',
 name: 'LINK Aja',
 code: 'ewallet_linkaja',
 logo: '/images/payment-methods/linkaja.jpg',
 type: 'ewallet',
 minAmount: 10000,
 maxAmount: 100000000,
 },
];

// Quick amount options
const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

function formatCurrency(amount: number): string {
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount);
}

function formatNumber(value: string): string {
 // Remove non-numeric characters
 const numericValue = value.replace(/\D/g, '');
 // Format with thousand separators
 return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseNumber(value: string): number {
 return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

export default function Deposit() {
 const [, setLocation] = useLocation();
 const [step, setStep] = useState<'amount' | 'method' | 'payment'>('amount');
 const [amount, setAmount] = useState('');
 const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [paymentInfo, setPaymentInfo] = useState<{
 vaNumber?: string;
 paymentUrl?: string;
 qrString?: string;
 qrUrl?: string;
 expiresAt?: string;
 invoiceId?: string;
 } | null>(null);
 const [copiedText, setCopiedText] = useState('');

 const numericAmount = parseNumber(amount);

 const handleAmountChange = (value: string) => {
 const formatted = formatNumber(value);
 setAmount(formatted);
 };

 const handleQuickAmount = (value: number) => {
 setAmount(formatNumber(value.toString()));
 };

 const handleSelectMethod = (method: PaymentMethod) => {
 setSelectedMethod(method);
 };

 const handleContinueToMethod = () => {
 if (numericAmount < 10000) {
 toast.error('Minimum top up adalah Rp10.000');
 return;
 }
 if (numericAmount > 100000000) {
 toast.error('Maximum top up adalah Rp100.000.000');
 return;
 }
 setStep('method');
 };

 const handleContinueToPayment = async () => {
 if (!selectedMethod) {
 toast.error('Pilih metode pembayaran');
 return;
 }

 // Validate amount against method limits
 if (selectedMethod.minAmount && numericAmount < selectedMethod.minAmount) {
 toast.error(`Minimum untuk ${selectedMethod.name} adalah ${formatCurrency(selectedMethod.minAmount)}`);
 return;
 }
 if (selectedMethod.maxAmount && numericAmount > selectedMethod.maxAmount) {
 toast.error(`Maximum untuk ${selectedMethod.name} adalah ${formatCurrency(selectedMethod.maxAmount)}`);
 return;
 }

 setIsSubmitting(true);
 try {
 const response = await walletApi.topUp({
 amount: numericAmount,
 method: selectedMethod.code,
 });

 const data = response.data;
 const resolvedPaymentUrl =
 data.paymentUrl ||
 data.payment_url ||
 data.actions?.mobile_web_checkout_url ||
 data.actions?.desktop_web_checkout_url ||
 data.actions?.mobile_deeplink_checkout_url;

 setPaymentInfo({
 vaNumber: data.vaNumber || data.va_number,
 paymentUrl: resolvedPaymentUrl,
 qrString: data.qrString || data.qr_string,
 qrUrl: data.qrUrl || data.qr_url,
 expiresAt: data.expiresAt || data.expires_at,
 invoiceId: data.invoiceId || data.invoice_id || data.id,
 });
 
 setStep('payment');

 if (selectedMethod?.type === 'ewallet' && resolvedPaymentUrl) {
 window.location.assign(resolvedPaymentUrl);
 }

 toast.success('Invoice berhasil dibuat');
 } catch (error: unknown) {
 toast.error(error.response?.data?.message || 'Gagal membuat invoice pembayaran');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleCopy = async (text: string, label: string) => {
 try {
 await navigator.clipboard.writeText(text);
 setCopiedText(text);
 toast.success(`${label} berhasil disalin`);
 setTimeout(() => setCopiedText(''), 2000);
 } catch (error) {
 toast.error('Gagal menyalin');
 }
 };

 const handleOpenPaymentUrl = () => {
 if (paymentInfo?.paymentUrl) {
 window.open(paymentInfo.paymentUrl, '_blank');
 }
 };

 const handleBackToWallet = () => {
 setLocation('/wallet');
 };

 // Render amount input step
 const renderAmountStep = () => (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="space-y-6"
 >
 {/* Amount Display */}
 <div className="text-center py-8">
 <div className="text-4xl md:text-5xl font-bold text-black mb-2">
 {numericAmount > 0 ? formatCurrency(numericAmount) : 'Rp0'}
 </div>
 <p className="text-neutral-400 text-sm">Jumlah isi ulang</p>
 </div>

 {/* Amount Input */}
 <div className="space-y-2">
 <Label htmlFor="amount" className="text-sm text-neutral-600">
 Masukkan nominal
 </Label>
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">
 Rp
 </span>
 <Input
 id="amount"
 type="text"
 inputMode="numeric"
 value={amount}
 onChange={(e) => handleAmountChange(e.target.value)}
 placeholder="0"
 className="pl-12 h-14 text-xl font-semibold bg-neutral-50 border-neutral-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black"
 />
 </div>
 </div>

 {/* Quick Amount Options */}
 <div className="space-y-2">
 <Label className="text-sm text-neutral-600">Pilih nominal cepat</Label>
 <div className="grid grid-cols-3 gap-2">
 {quickAmounts.map((value) => (
 <Button
 key={value}
 onClick={() => handleQuickAmount(value)}
 className={cn(
 "py-3 px-4 rounded-xl text-sm font-medium transition-all",
 numericAmount === value
 ? "bg-black text-white"
 : "bg-neutral-100 text-black hover:bg-neutral-200"
 )}
 >
 {formatCurrency(value).replace('Rp', 'Rp ')}
 </Button>
 ))}
 </div>
 </div>

 {/* Total Summary */}
 <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-neutral-600">Jumlah top up</span>
 <span className="font-semibold text-black">
 {numericAmount > 0 ? formatCurrency(numericAmount) : '-'}
 </span>
 </div>
 <div className="h-px bg-neutral-200" />
 <div className="flex justify-between items-center">
 <span className="text-neutral-600">Jumlah total</span>
 <span className="font-bold text-black text-lg">
 {numericAmount > 0 ? formatCurrency(numericAmount) : '-'}
 </span>
 </div>
 </div>

 {/* Continue Button */}
 <Button
 onClick={handleContinueToMethod}
 disabled={numericAmount < 1000}
 className="w-full h-14 bg-black hover:bg-black/90 text-white rounded-xl font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Lanjutkan
 </Button>
 </motion.div>
 );

 // Render payment method selection step
 const renderMethodStep = () => (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="space-y-6"
 >
 {/* Amount Summary */}
 <div className="text-center py-4 border-b border-neutral-200">
 <div className="text-3xl font-bold text-black mb-1">
 {formatCurrency(numericAmount)}
 </div>
 <p className="text-neutral-400 text-sm">Jumlah isi ulang</p>
 </div>

 {/* Total Row */}
 <div className="flex justify-between items-center py-3 border-b border-neutral-200">
 <span className="text-[var(--color-black)]">Jumlah total</span>
 <span className="font-bold text-black">{formatCurrency(numericAmount)}</span>
 </div>

 {/* Payment Methods */}
 <div className="space-y-4">
 <h3 className="font-semibold text-black text-lg">Pilih Metode Pembayaran</h3>
 
 <div className="space-y-2">
 {paymentMethods.map((method) => (
 <Button
 key={method.id}
 onClick={() => handleSelectMethod(method)}
 className={cn(
 "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
 selectedMethod?.id === method.id
 ? "border-black bg-black/5"
 : "border-transparent bg-white hover:bg-neutral-50"
 )}
 >
 {/* Logo */}
 <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-neutral-200 p-2">
 <img
 src={method.logo}
 alt={method.name}
 className="w-full h-full object-contain"
 onError={(e) => {
 // Fallback to text if image fails
 (e.target as HTMLImageElement).style.display = 'none';
 }}
 />
 </div>

 {/* Info */}
 <div className="flex-1 text-left">
 <div className="font-semibold text-black">{method.name}</div>
 {method.description && (
 <div className="text-sm text-neutral-400">{method.description}</div>
 )}
 </div>

 {/* Radio */}
 <div className={cn(
 "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
 selectedMethod?.id === method.id
 ? "border-black"
 : "border-neutral-200"
 )}>
 {selectedMethod?.id === method.id && (
 <div className="w-3 h-3 rounded-full bg-black" />
 )}
 </div>
 </Button>
 ))}
 </div>
 </div>

 {/* Continue Button */}
 <Button
 onClick={handleContinueToPayment}
 disabled={!selectedMethod || isSubmitting}
 className="w-full h-14 bg-black hover:bg-black/90 text-white rounded-xl font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSubmitting ? (
 <span className="flex items-center gap-2">
 <Spinner className="w-5 h-5 animate-spin" aria-hidden="true" />
 Memproses...
 </span>
 ) : (
 'Isi Ulang'
 )}
 </Button>
 </motion.div>
 );

 // Render payment info step
 const renderPaymentStep = () => (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="space-y-6"
 >
 {/* Success Header */}
 <div className="text-center py-6">
 <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
 <Check className="w-8 h-8 text-green-600" aria-hidden="true" weight="bold" />
 </div>
 <h2 className="text-xl font-bold text-black mb-2">Invoice Dibuat</h2>
 <p className="text-neutral-600">Silakan selesaikan pembayaran Anda</p>
 </div>

 {/* Payment Details */}
 <div className="bg-neutral-50 rounded-xl p-4 space-y-4">
 <div className="flex justify-between items-center">
 <span className="text-neutral-600">Metode Pembayaran</span>
 <span className="font-semibold text-black">{selectedMethod?.name}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-neutral-600">Jumlah</span>
 <span className="font-bold text-black text-lg">{formatCurrency(numericAmount)}</span>
 </div>
 {paymentInfo?.expiresAt && (
 <div className="flex justify-between items-center">
 <span className="text-neutral-600">Berlaku hingga</span>
 <span className="text-orange-500 font-medium flex items-center gap-1">
 <Clock className="w-4 h-4" aria-hidden="true" />
 {new Date(paymentInfo.expiresAt).toLocaleString('id-ID')}
 </span>
 </div>
 )}
 </div>

 {/* QR Code for QRIS */}
 {selectedMethod?.type === 'qris' && paymentInfo?.qrUrl && (
 <div className="bg-white rounded-xl p-6 border border-neutral-200 text-center">
 <div className="mb-4">
 <QrCode className="w-8 h-8 text-black mx-auto mb-2" aria-hidden="true" />
 <p className="text-sm text-neutral-600">Scan QR Code dengan aplikasi e-wallet atau mobile banking</p>
 </div>
 <img
 src={paymentInfo.qrUrl}
 alt="QR Code"
 className="w-48 h-48 mx-auto border border-neutral-200 rounded-lg"
 />
 </div>
 )}

 {/* Virtual Account Number */}
 {selectedMethod?.type === 'va' && paymentInfo?.vaNumber && (
 <div className="bg-white rounded-xl p-4 border border-neutral-200">
 <Label className="text-sm text-neutral-600 mb-2 block">Nomor Virtual Account</Label>
 <div className="flex items-center gap-2">
 <div className="flex-1 bg-neutral-50 rounded-lg p-2 font-mono text-lg font-semibold">
 {paymentInfo.vaNumber}
 </div>
 <Button
 variant="outline"
 size="icon"
 onClick={() => handleCopy(paymentInfo.vaNumber!, 'Nomor VA')}
 className="shrink-0"
 >
 {copiedText === paymentInfo.vaNumber ? (
 <Check className="w-5 h-5 text-green-600" aria-hidden="true" />
 ) : (
 <Copy className="w-5 h-5" aria-hidden="true" />
 )}
 </Button>
 </div>
 </div>
 )}

 {/* E-Wallet Payment URL */}
 {selectedMethod?.type === 'ewallet' && paymentInfo?.paymentUrl && (
 <div className="space-y-4">
 <div className="bg-orange-50 rounded-xl p-4 flex items-start gap-3">
 <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
 <p className="text-sm text-orange-700">
 Anda akan diarahkan ke aplikasi {selectedMethod.name} untuk menyelesaikan pembayaran.
 </p>
 </div>
 <Button
 onClick={handleOpenPaymentUrl}
 className="w-full h-14 bg-black hover:bg-black/90 text-white rounded-xl font-semibold text-base"
 >
 <span className="flex items-center gap-2">
 Buka {selectedMethod.name}
 <ArrowRight className="w-5 h-5" aria-hidden="true" />
 </span>
 </Button>
 </div>
 )}

 {/* Invoice ID */}
 {paymentInfo?.invoiceId && (
 <div className="text-center">
 <p className="text-xs text-neutral-400">
 Invoice ID: {paymentInfo.invoiceId}
 </p>
 </div>
 )}

 {/* Back to Wallet Button */}
 <Button
 variant="outline"
 onClick={handleBackToWallet}
 className="w-full h-12 rounded-xl font-medium"
 >
 Kembali ke Wallet
 </Button>
 </motion.div>
 );

 return (
 <DashboardLayout title="Top Up">
 <div className="max-w-md mx-auto">
 <AnimatePresence mode="wait">
 {step === 'amount' && renderAmountStep()}
 {step === 'method' && renderMethodStep()}
 {step === 'payment' && renderPaymentStep()}
 </AnimatePresence>
 </div>
 </DashboardLayout>
 );
}
