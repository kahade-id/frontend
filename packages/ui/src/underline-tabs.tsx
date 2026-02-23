/*
 * UNDERLINE TABS COMPONENT
 * 
 * Clean, minimal tab design with:
 * - Active tab: Black text with bold font and underline
 * - Inactive tab: Gray text
 * - Smooth transition animations
 */

import { motion } from 'framer-motion';
import { cn } from '@kahade/utils';

interface Tab {
 id: string;
 label: string;
 count?: number;
}

interface UnderlineTabsProps {
 tabs: Tab[];
 activeTab: string;
 onTabChange: (tabId: string) => void;
 className?: string;
}

export function UnderlineTabs({ tabs, activeTab, onTabChange, className }: UnderlineTabsProps) {
 return (
 <div className={cn("border-b border-neutral-200", className)}>
 <div className="flex gap-6 overflow-x-auto scrollbar-hide">
 {tabs.map((tab) => {
 const isActive = activeTab === tab.id;
 
 return (
 <button
 key={tab.id}
 onClick={() => onTabChange(tab.id)}
 className={cn(
 "relative pb-3 text-sm font-medium whitespace-nowrap transition-colors duration-200",
 isActive 
 ? "text-foreground font-semibold" 
 : "text-neutral-500 hover:text-neutral-600"
 )}
 >
 <span className="flex items-center gap-2">
 {tab.label}
 {tab.count !== undefined && (
 <span className={cn(
 "px-1.5 py-0.5 text-xs rounded-full",
 isActive 
 ? "bg-black text-white" 
 : "bg-neutral-100 text-neutral-600"
 )}>
 {tab.count}
 </span>
 )}
 </span>
 
 {/* Active Underline */}
 {isActive && (
 <motion.div
 layoutId="activeTabUnderline"
 className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"
 initial={false}
 transition={{ type: "spring", stiffness: 500, damping: 30 }}
 />
 )}
 </button>
 );
 })}
 </div>
 </div>
 );
}

// Simple version without animation for SSR compatibility
export function UnderlineTabsSimple({ tabs, activeTab, onTabChange, className }: UnderlineTabsProps) {
 return (
 <div className={cn("border-b border-neutral-200", className)}>
 <div className="flex gap-6 overflow-x-auto scrollbar-hide">
 {tabs.map((tab) => {
 const isActive = activeTab === tab.id;
 
 return (
 <button
 key={tab.id}
 onClick={() => onTabChange(tab.id)}
 className={cn(
 "relative pb-3 text-sm font-medium whitespace-nowrap transition-colors duration-200",
 isActive 
 ? "text-foreground font-semibold border-b-2 border-black" 
 : "text-neutral-500 hover:text-neutral-600"
 )}
 >
 <span className="flex items-center gap-2">
 {tab.label}
 {tab.count !== undefined && (
 <span className={cn(
 "px-1.5 py-0.5 text-xs rounded-full",
 isActive 
 ? "bg-black text-white" 
 : "bg-neutral-100 text-neutral-600"
 )}>
 {tab.count}
 </span>
 )}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 );
}

export default UnderlineTabs;
