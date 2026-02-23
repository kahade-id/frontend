/*
 * KAHADE BOTTOM NAVIGATION - Professional Mobile App Navigation
 * 
 * Design Philosophy:
 * - Clean, minimal design without background effects
 * - Fixed bottom navigation that doesn't move on scroll
 * - Smaller centered plus button with gray background (#EEEEEE)
 * - Only shows on main pages: Home, Transactions, Wallet, Profile
 * - No dots, no background icons
 * - Consistent 24px icon size
 */

import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
 House, Receipt, Plus, Wallet, User
} from '@phosphor-icons/react';
import { cn } from '@kahade/utils';

interface NavItem {
 href: string;
 icon: typeof House;
 label: string;
 isAction?: boolean;
}

const navItems: NavItem[] = [
 { href: '/', icon: House, label: 'Beranda' },
 { href: '/transactions', icon: Receipt, label: 'Pesanan' },
 { href: '/transactions/new', icon: Plus, label: '', isAction: true },
 { href: '/wallet', icon: Wallet, label: 'Dompet' },
 { href: '/profile', icon: User, label: 'Profil' },
];

// Pages where bottom navigation should be shown
const MAIN_PAGES = ['/', '/transactions', '/wallet', '/profile'];

export default function BottomNavigation() {
 const [location] = useLocation();

 // Only show bottom navigation on main pages (Home, Transactions, Wallet, Profile)
 // Check for exact match for '/' and prefix match for others
 const shouldShowNavigation = MAIN_PAGES.some(page => {
 if (page === '/') {
 return location === '/';
 }
 // For other pages, check exact match only (not subpages like /transactions/new or /transactions/:id)
 return location === page;
 });

 if (!shouldShowNavigation) {
 return null;
 }

 return (
 <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
 {/* White background white */}
 <div className="absolute inset-0 bg-card border-t border-border" aria-hidden="true" />
 
 {/* Safe area padding for notched devices */}
 <div className="relative">
 {/* Navigation items container */}
 <div className="flex items-center justify-around px-2 h-[64px]">
 {navItems.map((item) => {
 const isActive = item.href === '/' 
 ? location === '/' 
 : location.startsWith(item.href);
 
 // Center action button (Create Transaction)
 if (item.isAction) {
 return (
 <Link key={item.href} href={item.href}>
 <motion.div
 whileTap={{ scale: 0.95 }}
 className="flex items-center justify-center"
 >
 {/* Small circle button with gray background #EEEEEE */}
 <div className={cn(
 "w-11 h-11 rounded-full flex items-center justify-center",
 "bg-neutral-200",
 "transition-all duration-200"
 )}>
 <Plus 
 className="w-6 h-6 text-black" 
 weight="bold" 
 />
 </div>
 </motion.div>
 </Link>
 );
 }

 // Regular nav items
 return (
 <Link key={item.href} href={item.href}>
 <motion.div
 whileTap={{ scale: 0.95 }}
 className={cn(
 "flex flex-col items-center justify-center py-2 px-3 min-w-[56px]",
 "transition-all duration-200"
 )}
 >
 {/* Icon - 24px size */}
 <item.icon 
 className={cn(
 "w-6 h-6 transition-colors duration-200",
 isActive ? "text-black" : "text-neutral-400"
 )} 
 weight={isActive ? 'fill' : 'regular'} 
 />
 
 {/* Label */}
 <span 
 className={cn(
 "text-[11px] font-medium mt-1 transition-all duration-200",
 isActive ? "text-black" : "text-neutral-400"
 )}
 >
 {item.label}
 </span>
 </motion.div>
 </Link>
 );
 })}
 </div>
 
 {/* Bottom safe area spacer */}
 <div className="h-safe-area-inset-bottom bg-transparent" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
 </div>
 </nav>
 );
}
