/*
 * KAHADE LANDING LAYOUT
 * Wrapper component for landing pages with Navbar and Footer
 */

import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface LandingLayoutProps {
 children: ReactNode;
 showNavbar?: boolean;
 showFooter?: boolean;
}

export default function LandingLayout({ 
 children, 
 showNavbar = true, 
 showFooter = true 
}: LandingLayoutProps) {
 return (
 <div className="min-h-screen bg-card flex flex-col">
 {showNavbar && <Navbar />}
 <main className="flex-1">
 {children}
 </main>
 {showFooter && <Footer />}
 </div>
 );
}
