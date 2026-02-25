/*
 * KAHADE ADMIN LAYOUT
 * 
 * Features:
 * - Admin sidebar with nested menus
 * - Top bar with global search, notifications, admin profile menu
 * - Enterprise feel while staying minimalist
 * - Phosphor Icons only
 */

import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
 House, Users, ArrowsLeftRight, Warning, FileText, Gear,
 SignOut, List, X, CaretRight, CaretDown, MagnifyingGlass,
 Bell, ChartBar, ShieldCheck, Database, ClockCounterClockwise,
 UserCircleGear, Sliders, Key, Globe, IdentificationCard,
 ArrowDown, Tag, Wallet
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@kahade/utils';

// Navigation item interface
interface NavItemType {
 href: string;
 icon: React.ElementType;
 label: string;
 children?: NavItemType[];
}

interface AdminLayoutProps {
 children: ReactNode;
 title?: string;
 subtitle?: string;
}

// Nested navigation structure
const navSections = [
 {
 title: 'Ikhtisar',
 items: [
 { href: '/', icon: House, label: 'Dashboard' },
 ]
 },
 {
 title: 'Manajemen',
 items: [
 { href: '/users', icon: Users, label: 'Pengguna' },
 { href: '/kyc', icon: IdentificationCard, label: 'Verifikasi KYC' },
 { href: '/transactions', icon: ArrowsLeftRight, label: 'Transaksi' },
 { href: '/disputes', icon: Warning, label: 'Sengketa' },
 { href: '/withdrawals', icon: ArrowDown, label: 'Penarikan' },
 { href: '/deposits', icon: Wallet, label: 'Setoran' },
 ]
 },
 {
 title: 'Analitik',
 items: [
 { href: '/reports', icon: ChartBar, label: 'Laporan' },
 ]
 },
 {
 title: 'Pemasaran',
 items: [
 { href: '/promos', icon: Tag, label: 'Promosi' },
 ]
 },
 {
 title: 'Sistem',
 items: [
 { href: '/audit-logs', icon: ClockCounterClockwise, label: 'Log Audit' },
 { href: '/settings', icon: Gear, label: 'Pengaturan' },
 ]
 },
];

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
 const [location, setLocation] = useLocation();
 const { user, logout } = useAuth();
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
 const [searchQuery, setSearchQuery] = useState('');
 const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

 const handleLogout = async () => {
 await logout();
 setLocation('/');
 };

 const toggleMenu = (label: string) => {
 setExpandedMenus(prev => 
 prev.includes(label) 
 ? prev.filter(l => l !== label)
 : [...prev, label]
 );
 };

 const isMenuExpanded = (label: string) => expandedMenus.includes(label);

 const isActive = (href: string) => {
 if (href === '/') return location === '/';
 return location.startsWith(href);
 };

 const renderNavItem = (item: NavItemType, isMobile = false) => {
 if (item.children) {
 const isExpanded = isMenuExpanded(item.label);
 const hasActiveChild = item.children.some((child: NavItemType) => isActive(child.href));
 
 return (
 <div key={item.label}>
 <Button
 onClick={() => toggleMenu(item.label)}
 className={cn(
 'flex items-center gap-4 w-full px-4 py-3 rounded-lg transition-all',
 hasActiveChild
 ? 'bg-accent/10 text-accent'
 : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
 )}
 >
 <item.icon className="w-5 h-5" weight={hasActiveChild ? 'fill' : 'regular'} />
 <span className="font-medium flex-1 text-left">{item.label}</span>
 <CaretDown className={cn(
 "w-4 h-4 transition-transform",
 isExpanded && "rotate-180"
 )} />
 </Button>
 
 <AnimatePresence>
 {isExpanded && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="overflow-hidden"
 >
 <div className="pl-12 py-1 space-y-1">
 {item.children.map((child: NavItemType) => (
 <Link
 key={child.href}
 href={child.href}
 onClick={isMobile ? () => setIsSidebarOpen(false) : undefined}
 className={cn(
 'block px-4 py-2 rounded-lg text-sm transition-colors',
 isActive(child.href)
 ? 'bg-accent/10 text-accent font-medium'
 : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
 )}
 >
 {child.label}
 </Link>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
 }

 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={isMobile ? () => setIsSidebarOpen(false) : undefined}
 className={cn(
 'flex items-center gap-4 px-4 py-3 rounded-lg transition-all',
 isActive(item.href)
 ? 'bg-accent/10 text-accent'
 : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
 )}
 >
 <item.icon className="w-5 h-5" weight={isActive(item.href) ? 'fill' : 'regular'} />
 <span className="font-medium">{item.label}</span>
 {isActive(item.href) && <CaretRight className="w-4 h-4 ml-auto" aria-hidden="true" />}
 </Link>
 );
 };

 return (
 <div className="min-h-screen flex bg-neutral-50">
 {/* Sidebar - Desktop */}
 <aside className="hidden lg:flex flex-col w-72 border-r border-border bg-card">
 {/* Logo */}
 <div className="p-4 border-b border-border">
 <Link href="/" className="block flex items-center gap-3">
 <img src="/images/logo.svg" alt="Kahade" className="h-8 w-auto" />
 <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-600 rounded-md">
 ADMIN
 </span>
 </Link>
 </div>
 
 {/* Navigation */}
 <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
 {navSections.map((section) => (
 <div key={section.title}>
 <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
 {section.title}
 </div>
 <div className="space-y-1">
 {section.items.map((item) => renderNavItem(item))}
 </div>
 </div>
 ))}
 </nav>
 
 {/* User Info & Actions */}
 <div className="p-4 border-t border-border">
 <div className="flex items-center gap-4 mb-4">
 <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold">
 A
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium truncate">Admin</div>
 <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
 </div>
 </div>
 <div className="flex gap-2">
 <a href={import.meta.env.VITE_APP_URL || 'https://app.kahade.id'} className="flex-1">
 <Button variant="outline" size="sm" className="w-full">
 <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
 User View
 </Button>
 </a>
 <Button 
 variant="ghost" 
 size="sm"
 className="text-muted-foreground hover:text-destructive"
 onClick={handleLogout}
 >
 <SignOut className="w-4 h-4" aria-hidden="true" />
 </Button>
 </div>
 </div>
 </aside>
 
 {/* Mobile Sidebar */}
 <AnimatePresence>
 {isSidebarOpen && (
 <>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black/50 z-40 lg:hidden"
 onClick={() => setIsSidebarOpen(false)}
 />
 <motion.aside
 initial={{ x: -300 }}
 animate={{ x: 0 }}
 exit={{ x: -300 }}
 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
 className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 lg:hidden overflow-y-auto"
 >
 <div className="p-4 flex items-center justify-between border-b border-border sticky top-0 bg-card">
 <Link href="/" className="block flex items-center gap-2">
 <img src="/images/logo.svg" alt="Kahade" className="h-8 w-auto" />
 <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-600 rounded-md">
 ADMIN
 </span>
 </Link>
 <Button 
 onClick={() => setIsSidebarOpen(false)}
 className="p-2 hover:bg-secondary rounded-lg"
 >
 <X className="w-5 h-5" weight="bold" aria-hidden="true" />
 </Button>
 </div>
 
 <nav className="p-4 space-y-6">
 {navSections.map((section) => (
 <div key={section.title}>
 <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
 {section.title}
 </div>
 <div className="space-y-1">
 {section.items.map((item) => renderNavItem(item, true))}
 </div>
 </div>
 ))}
 </nav>
 </motion.aside>
 </>
 )}
 </AnimatePresence>
 
 {/* Main Content */}
 <main className="flex-1 flex flex-col min-h-screen">
 {/* Top Bar */}
 <header className="sticky top-0 z-30 border-b border-border bg-card">
 <div className="flex items-center justify-between px-4 lg:px-8 py-4">
 <div className="flex items-center gap-4">
 <Button 
 className="lg:hidden p-2 hover:bg-secondary rounded-lg"
 onClick={() => setIsSidebarOpen(true)}
 >
 <List className="w-6 h-6" aria-hidden="true" weight="bold" />
 </Button>
 <div>
 {title && <h1 className="text-xl font-bold">{title}</h1>}
 {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
 </div>
 </div>
 
 <div className="flex items-center gap-3">
 {/* Global Search */}
 <div className="hidden md:flex relative">
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <Input
 type="search"
 placeholder="Cari pengguna, transaksi..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 w-80 bg-secondary border-0"
 />
 </div>
 
 {/* Notifications */}
 <Button variant="ghost" size="icon" className="relative">
 <Bell className="w-5 h-5" aria-hidden="true" />
 <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
 </Button>
 
 {/* Admin Profile Menu */}
 <div className="relative">
 <Button
 onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
 className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg transition-colors"
 >
 <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-semibold">
 A
 </div>
 <span className="hidden sm:block text-sm font-medium">Admin</span>
 <CaretDown className={cn(
 "w-4 h-4 transition-transform hidden sm:block",
 isProfileDropdownOpen && "rotate-180"
 )} />
 </Button>
 
 <AnimatePresence>
 {isProfileDropdownOpen && (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 10 }}
 className="absolute right-0 top-full mt-2 w-56 bg-card rounded-lg border border-border py-2 z-50"
 >
 <div className="px-4 py-2 border-b border-border">
 <div className="font-medium"> Administrator</div>
 <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
 </div>
 <Link
 href="/settings/general"
 onClick={() => setIsProfileDropdownOpen(false)}
 className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
 >
 <Gear className="w-4 h-4" aria-hidden="true" />
 System Settings
 </Link>
 <Link
 href="/audit-logs"
 onClick={() => setIsProfileDropdownOpen(false)}
 className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
 >
 <ClockCounterClockwise className="w-4 h-4" aria-hidden="true" />
 Audit Logs
 </Link>
 <div className="border-t border-border mt-2 pt-2">
 <Link
 href="/app"
 onClick={() => setIsProfileDropdownOpen(false)}
 className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
 >
 <Globe className="w-4 h-4" aria-hidden="true" />
 Switch to User View
 </Link>
 <Button
 onClick={handleLogout}
 className="flex items-center gap-4 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors w-full"
 >
 <SignOut className="w-4 h-4" aria-hidden="true" />
 Sign Out
 </Button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 </header>
 
 {/* Page Content */}
 <div className="flex-1 p-4 lg:p-8">
 {children}
 </div>
 </main>
 </div>
 );
}
