/**
 * Kahade landing — <LandingPage>: assembler seluruh section landing web.
 *
 * Urutan halaman: navbar → hero → problem → solution → cara kerja → fitur →
 * perbandingan → statistik → testimoni → keamanan → FAQ → unduh → footer.
 *
 * Navbar sticky dirender DI LUAR ScrollView (dalam View kolom flex-1) supaya
 * tidak terpotong oleh scroll container.
 *
 * Catatan: section LandingNavbar … LandingTestimonials dibuat paralel oleh
 * batch lain — modul-modul itu diimpor langsung sesuai kontrak nama.
 */
import { ScrollView, View } from "react-native"

import { LandingNavbar } from "@/components/landing/navbar"
import { LandingHero } from "@/components/landing/hero"
import { LandingProblem } from "@/components/landing/problem"
import { LandingSolution } from "@/components/landing/solution"
import { LandingHowItWorks } from "@/components/landing/how-it-works"
import { LandingFeatures } from "@/components/landing/features"
import { LandingComparison } from "@/components/landing/comparison"
import { LandingStats } from "@/components/landing/stats"
import { LandingTestimonials } from "@/components/landing/testimonials"
import { LandingSecurity } from "@/components/landing/security"
import { LandingFaq } from "@/components/landing/faq"
import { LandingCtaDownload } from "@/components/landing/cta-download"
import { LandingFooter } from "@/components/landing/footer"

export function LandingPage() {
  return (
    <View className="flex-1 bg-background">
      <LandingNavbar />
      <ScrollView className="flex-1" contentContainerClassName="grow">
        <LandingHero />
        <LandingProblem />
        <LandingSolution />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingComparison />
        <LandingStats />
        <LandingTestimonials />
        <LandingSecurity />
        <LandingFaq />
        <LandingCtaDownload />
        <LandingFooter />
      </ScrollView>
    </View>
  )
}
