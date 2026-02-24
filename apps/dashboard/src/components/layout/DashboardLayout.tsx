/*
 * KAHADE DASHBOARD LAYOUT - Professional Responsive Design
 * 
 * Design Philosophy:
 * - Mobile: Full-screen content with bottom navigation on main pages only
 * - Mobile: Arrow back header for non-main pages
 * - Tablet: Collapsible sidebar with optimized content area
 * - Desktop: Full sidebar with spacious content layout
 * - Consistent spacing, typography, and visual hierarchy
 * - Smooth transitions between breakpoints
 * - Auto scroll to top on page navigation
 */

import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
 House, Receipt, Wallet, Bell, User, Gear,
 SignOut, CaretRight, Plus, MagnifyingGlass,
 Bank, IdentificationCard, Users, Scales, ClockCounterClockwise,
 CaretDown, ArrowLeft
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@kahade/utils';
import BottomNavigation from './BottomNavigation';
import { LanguageSwitcherCompact } from '@kahade/ui';

interface DashboardLayoutProps {
 children: ReactNode;
 title?: string;
 subtitle?: string;
}

// Main navigation items for desktop/tablet sidebar
const mainNavItems = [
 { href: '/', icon: House, label: 'Beranda' },
 { href: '/transactions', icon: Receipt, label: 'Pesanan' },
 { href: '/wallet', icon: Wallet, label: 'Dompet' },
 { href: '/bank-accounts', icon: Bank, label: 'Rekening Bank' },
];

// Secondary navigation items for desktop/tablet sidebar
const secondaryNavItems = [
 { href: '/disputes', icon: Scales, label: 'Sengketa' },
 { href: '/referrals', icon: Users, label: 'Referral' },
 { href: '/kyc', icon: IdentificationCard, label: 'Verifikasi KYC' },
 { href: '/activity', icon: ClockCounterClockwise, label: 'Log Aktivitas' },
];

// Bottom navigation items for desktop/tablet sidebar
const bottomNavItems = [
 { href: '/notifications', icon: Bell, label: 'Notifikasi' },
 { href: '/profile', icon: User, label: 'Profil' },
 { href: '/settings', icon: Gear, label: 'Pengaturan' },
];

// Pages where bottom navigation should be shown (main pages)
const MAIN_PAGES = ['/', '/transactions', '/wallet', '/profile'];

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
 const [location, setLocation] = useLocation();
 const { user, logout } = useAuth();
 const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
 const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const mainContentRef = useRef<HTMLDivElement>(null);

 // Check if current page is a main page (should show bottom nav)
 const isMainPage = MAIN_PAGES.some(page => {
 if (page === '/') {
 return location === '/';
 }
 return location === page;
 });

 // Scroll to top when location changes
 useEffect(() => {
 window.scrollTo({ top: 0, behavior: 'instant' });
 if (mainContentRef.current) {
 mainContentRef.current.scrollTop = 0;
 }
 }, [location]);

 const handleLogout = async () => {
 await logout();
 setLocation('/');
 };

 const handleGoBack = () => {
 // Use browser history to go back
 if (window.history.length > 1) {
 window.history.back();
 } else {
 // Fallback to home if no history
 setLocation('/');
 }
 };

 // Navigation item component
 const NavItem = ({ item, collapsed = false }: { 
 item: typeof mainNavItems[0]; 
 collapsed?: boolean;
 }) => {
 const isActive = item.href === '/' 
 ? location === '/' 
 : location.startsWith(item.href);
 
 return (
 <Link href={item.href}>
 <motion.div
 whileTap={{ scale: 0.98 }}
 className={cn(
 'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200',
 isActive
 ? 'bg-black text-white shadow-black/20'
 : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
 collapsed && 'justify-center px-3'
 )}
 title={collapsed ? item.label : undefined}
 >
 /* FIX (v3.2): item.icon as JSX invalid — harus destructure ke PascalCase */ <item.icon 
 className={cn("w-5 h-5 shrink-0", isActive && "text-white")} 
 weight={isActive ? 'fill' : 'regular'} 
 />
 {!collapsed && (
 <span className="font-medium text-[15px]">{item.label}</span>
 )}
 </motion.div>
 </Link>
 );
 };

 return (
 <div className="min-h-screen flex bg-card">
 {/* ========== DESKTOP SIDEBAR ========== */}
 <aside 
 className={cn(
 "hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 ease-out",
 isSidebarCollapsed ? "w-[72px]" : "w-[280px]"
 )}
 >
 {/* Logo Section */}
 <div className={cn(
 "h-16 flex items-center justify-between border-b border-border",
 isSidebarCollapsed ? "px-3" : "px-5"
 )}>
 <Link href="/" className="block flex items-center gap-3">
 {isSidebarCollapsed ? (
 <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
 <span className="text-white font-bold text-lg">K</span>
 </div>
 ) : (
 <img 
 src="/images/logo.svg" 
 alt="Kahade" 
 className="h-8 w-auto"
 />
 )}
 </Link>
 {!isSidebarCollapsed && (
 <Button
 onClick={() => setIsSidebarCollapsed(true)}
 className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
 aria-label="Sembunyikan sidebar"
 >
 <CaretRight className="w-4 h-4 rotate-180 text-neutral-500" aria-hidden="true" weight="bold" />
 </Button>
 )}
 </div>
 
 {/* Quick Action Button */}
 <div className={cn("p-4", isSidebarCollapsed && "px-3")}>
 <Link href="/transactions/create" className="block">
 <Button className={cn(
 "w-full h-12 bg-black hover:bg-black/90 text-white rounded-xl font-semibold shadow-black/20 transition-all",
 isSidebarCollapsed ? "px-0 justify-center" : "justify-center gap-2"
 )}>
 <Plus className="w-5 h-5" aria-hidden="true" weight="bold" />
 {!isSidebarCollapsed && <span>Order Baru</span>}
 </Button>
 </Link>
 </div>
 
 {/* Main Navigation */}
 <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
 {/* Main Items */}
 <div className="space-y-1">
 {mainNavItems.map((item) => (
 <NavItem key={item.href} item={item} collapsed={isSidebarCollapsed} />
 ))}
 </div>
 
 {/* Divider */}
 <div className={cn("my-4 h-px bg-neutral-200", isSidebarCollapsed ? "mx-1" : "mx-2")} />
 
 {/* Secondary Items */}
 <div className="space-y-1">
 {secondaryNavItems.map((item) => (
 <NavItem key={item.href} item={item} collapsed={isSidebarCollapsed} />
 ))}
 </div>
 
 {/* Divider */}
 <div className={cn("my-4 h-px bg-neutral-200", isSidebarCollapsed ? "mx-1" : "mx-2")} />
 
 {/* Bottom Items */}
 <div className="space-y-1">
 {bottomNavItems.map((item) => (
 <NavItem key={item.href} item={item} collapsed={isSidebarCollapsed} />
 ))}
 </div>
 </nav>
 
 {/* Expand Button (when collapsed) */}
 {isSidebarCollapsed && (
 <div className="p-3 border-t border-border">
 <Button
 onClick={() => setIsSidebarCollapsed(false)}
 className="w-full p-2 hover:bg-neutral-100 rounded-xl transition-colors flex items-center justify-center"
 aria-label="Tampilkan sidebar"
 >
 <CaretRight className="w-5 h-5 text-neutral-500" aria-hidden="true" weight="bold" />
 </Button>
 </div>
 )}
 
 {/* User Section (when expanded) */}
 {!isSidebarCollapsed && (
 <div className="p-4 border-t border-border">
 {/* User Card */}
 <div className="flex items-center gap-4 p-2 rounded-xl bg-neutral-50 mb-3">
 <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white font-bold">
 {user?.username?.charAt(0).toUpperCase() || 'U'}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-black truncate">{user?.username || 'User'}</div>
 <div className="text-xs text-neutral-600 truncate">{user?.email}</div>
 </div>
 </div>
 
 {/* Language Switcher */}
 <div className="flex items-center justify-between px-4 py-2 mb-2">
 <span className="text-sm text-neutral-600">Bahasa</span>
 <LanguageSwitcherCompact />
 </div>
 
 {/* Logout Button */}
 <Button
 onClick={handleLogout}
 className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-colors"
 >
 <SignOut className="w-5 h-5" aria-hidden="true" weight="bold" />
 <span className="font-medium">Keluar</span>
 </Button>
 </div>
 )}
 </aside>
 
 {/* ========== TABLET SIDEBAR (md breakpoint) ========== */}
 <aside className="hidden md:flex lg:hidden flex-col w-[72px] border-r border-border bg-card">
 {/* Logo */}
 <div className="h-16 flex items-center justify-center border-b border-border">
 <Link href="/" className="block">
 <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
 <span className="text-white font-bold text-lg">K</span>
 </div>
 </Link>
 </div>
 
 {/* Quick Action */}
 <div className="p-3">
 <Link href="/transactions/create" className="block">
 <Button className="w-full h-12 bg-black hover:bg-black/90 text-white rounded-xl px-0 justify-center shadow-black/20">
 <Plus className="w-5 h-5" aria-hidden="true" weight="bold" />
 </Button>
 </Link>
 </div>
 
 {/* Navigation */}
 <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
 {[...mainNavItems, ...secondaryNavItems].map((item) => {
 const isActive = item.href === '/' 
 ? location === '/' 
 : location.startsWith(item.href);
 
 return (
 <Link key={item.href} href={item.href}>
 <motion.div
 whileTap={{ scale: 0.95 }}
 className={cn(
 'flex items-center justify-center p-2 rounded-xl transition-all duration-200',
 isActive
 ? 'bg-black text-white shadow-black/20'
 : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
 )}
 title={item.label}
 >
 /* FIX (v3.2): item.icon as JSX invalid — harus destructure ke PascalCase */ <item.icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
 </motion.div>
 </Link>
 );
 })}
 </nav>
 
 {/* Bottom Items */}
 <div className="p-2 border-t border-border space-y-1">
 {bottomNavItems.map((item) => {
 const isActive = location.startsWith(item.href);
 
 return (
 <Link key={item.href} href={item.href}>
 <div
 className={cn(
 'flex items-center justify-center p-2 rounded-xl transition-all duration-200',
 isActive
 ? 'bg-black text-white'
 : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
 )}
 title={item.label}
 >
 /* FIX (v3.2): item.icon as JSX invalid — harus destructure ke PascalCase */ <item.icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
 </div>
 </Link>
 );
 })}
 
 {/* User Avatar */}
 <Button
 onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
 className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-neutral-100 transition-colors"
 >
 <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-bold text-sm">
 {user?.username?.charAt(0).toUpperCase() || 'U'}
 </div>
 </Button>
 </div>
 </aside>
 
 {/* ========== MAIN CONTENT ========== */}
 <main ref={mainContentRef} className="flex-1 flex flex-col min-h-screen min-w-0">
 {/* Mobile Header - Only show on non-main pages with back button */}
 {!isMainPage && (
 <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur-xl md:hidden">
 <div className="flex items-center h-full px-4">
 {/* Back Button */}
 <Button
 onClick={handleGoBack}
 className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl hover:bg-neutral-100 transition-colors"
 aria-label="Kembali"
 >
 <ArrowLeft className="w-6 h-6 text-black" aria-hidden="true" weight="bold" />
 </Button>
 
 {/* Page Title */}
 <div className="flex-1 ml-2">
 {title && <h1 className="text-lg font-bold text-black truncate">{title}</h1>}
 </div>
 </div>
 </header>
 )}

 {/* Top Header Bar - Desktop/Tablet only */}
 <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-xl hidden md:block">
 <div className="flex items-center justify-between h-full px-4 md:px-6 lg:px-8">
 {/* Left Section */}
 <div className="flex items-center gap-4">
 {/* Page Title */}
 <div>
 {title && <h1 className="text-xl font-bold text-black">{title}</h1>}
 {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
 </div>
 </div>
 
 {/* Right Section */}
 <div className="flex items-center gap-2 md:gap-3">
 {/* Search - Desktop/Tablet */}
 <div className="hidden md:flex relative">
 <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" aria-hidden="true" />
 <Input
 type="search"
 placeholder="Cari..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) setLocation(`/transactions?q=${encodeURIComponent(searchQuery.trim())}`); }}
 className="pl-11 w-48 lg:w-[240px] h-10 bg-neutral-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:bg-card transition-all"
 />
 </div>
 
 {/* Notifications */}
 <Link href="/notifications" className="block">
 <Button className="relative p-2.5 hover:bg-neutral-100 rounded-xl transition-colors">
 <Bell className="w-5 h-5 text-neutral-600" aria-hidden="true" weight="bold" />
 <span className="absolute top-2 right-2 w-2 h-2 bg-black rounded-full ring-2 ring-white" />
 </Button>
 </Link>
 
 {/* Profile Dropdown - Desktop */}
 <div className="relative hidden md:block">
 <Button
 onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
 className="flex items-center gap-2 p-1.5 hover:bg-neutral-100 rounded-xl transition-colors"
 >
 <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white font-bold text-sm">
 {user?.username?.charAt(0).toUpperCase() || 'U'}
 </div>
 <CaretDown className={cn(
 "w-4 h-4 text-neutral-600 transition-transform hidden lg:block",
 isProfileDropdownOpen && "rotate-180"
 )} weight="bold" />
 </Button>
 
 <AnimatePresence>
 {isProfileDropdownOpen && (
 <>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-40"
 onClick={() => setIsProfileDropdownOpen(false)}
 />
 <motion.div
 initial={{ opacity: 0, y: 8, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 8, scale: 0.95 }}
 transition={{ duration: 0.15 }}
 className="absolute right-0 top-full mt-2 w-[240px] bg-card rounded-2xl border border-border shadow-black/10 z-50 overflow-hidden"
 >
 {/* User Info */}
 <div className="p-4 border-b border-border">
 <div className="font-semibold text-black">{user?.username || 'User'}</div>
 <div className="text-sm text-neutral-600">{user?.email}</div>
 </div>
 
 {/* Menu Items */}
 <div className="p-2">
 <Link
 href="/profile"
 onClick={() => setIsProfileDropdownOpen(false)}
 className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
 >
 <User className="w-5 h-5" aria-hidden="true" weight="bold" />
 <span className="font-medium">Profil</span>
 </Link>
 <Link
 href="/settings"
 onClick={() => setIsProfileDropdownOpen(false)}
 className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
 >
 <Gear className="w-5 h-5" aria-hidden="true" weight="bold" />
 <span className="font-medium">Pengaturan</span>
 </Link>
 </div>
 
 {/* Logout */}
 <div className="p-2 border-t border-border">
 <Button
 onClick={() => {
 setIsProfileDropdownOpen(false);
 handleLogout();
 }}
 className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-colors"
 >
 <SignOut className="w-5 h-5" aria-hidden="true" weight="bold" />
 <span className="font-medium">Keluar</span>
 </Button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 </header>
 
 {/* Page Content */}
 <div className={cn(
 "flex-1 p-4 md:p-6 lg:p-8",
 isMainPage ? "pb-24 md:pb-8" : "pb-8"
 )}>
 {children}
 </div>
 </main>
 
 {/* Mobile Bottom Navigation - Only on main pages */}
 <BottomNavigation />
 </div>
 );
}
