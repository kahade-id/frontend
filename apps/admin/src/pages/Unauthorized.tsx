/*
 * KAHADE 403 UNAUTHORIZED PAGE - Modern Design
 * Brand color: var(--color-black)
 */

import { motion } from 'framer-motion';
import { ShieldWarning, ArrowLeft, SignOut } from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { APP_URLS } from '@kahade/config';

export default function Unauthorized() {
 const handleGoToApp = () => {
 window.location.href = APP_URLS.app;
 };

 const handleLogout = async () => {
 // Clear session and redirect to landing
 sessionStorage.clear();
 window.location.href = APP_URLS.landing;
 };

 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-center max-w-lg"
 >
 {/* 403 Number */}
 <div className="relative mb-8">
 <h1 className="text-[150px] md:text-[200px] font-bold text-neutral-50 leading-none select-none">
 403
 </h1>
 <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
 <div className="w-24 h-24 rounded-lg bg-red-500 flex items-center justify-center">
 <ShieldWarning className="w-12 h-12 text-white" aria-hidden="true" weight="bold" />
 </div>
 </div>
 </div>
 
 <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
 Access Denied
 </h2>
 
 <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
 You don't have permission to access the admin panel. This area is restricted to administrators only.
 </p>
 
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <Button 
  variant="primary" className="gap-2"
 onClick={handleGoToApp}
 >
 <ArrowLeft className="w-5 h-5" aria-hidden="true" weight="bold" />
 Go to User Dashboard
 </Button>
 <Button 
  variant="secondary" className="gap-2"
 onClick={handleLogout}
 >
 <SignOut className="w-5 h-5" aria-hidden="true" weight="bold" />
 Logout
 </Button>
 </div>
 
 {/* Help Text */}
 <div className="mt-12 pt-8 border-t border-border">
 <p className="text-sm text-neutral-500">
 If you believe you should have access, please contact your system administrator.
 </p>
 </div>
 </motion.div>
 </div>
 );
}
