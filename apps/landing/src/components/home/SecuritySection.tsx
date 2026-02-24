/*
 * SECURITY SECTION
 *
 * Issue #30: Section "Keamanan" tidak hadir di homepage padahal muncul di nav
 * sebagai prioritas. Untuk produk escrow, Keamanan harus jadi pillar section
 * yang jelas mencakup: proses proteksi, dispute, KYC/AML, data security, audit trail.
 *
 * Section ini disisipkan di Home.tsx antara FeaturesSection dan HowItWorksSection.
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  ShieldCheck, Lock, Fingerprint, Eye,
  Scales, UserCircle, Certificate, ArrowRight,
  CheckCircle, Wallet, Key
} from '@phosphor-icons/react';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { SectionLabel } from '@kahade/ui';

const securityPillars = [
  {
    icon: Lock,
    title: 'Enkripsi Data AES-256',
    description: 'Data transaksi dienkripsi saat transit dan penyimpanan dengan standar AES-256 untuk perlindungan tingkat enterprise.',
  },
  {
    icon: Fingerprint,
    title: 'Verifikasi KYC/AML',
    description: 'Proses Know Your Customer yang ketat memastikan setiap pengguna terverifikasi identitasnya sebelum bertransaksi.',
  },
  {
    icon: Eye,
    title: 'Jejak Audit Lengkap',
    description: 'Setiap tindakan dalam transaksi dicatat dalam audit trail yang immutable — transparan untuk semua pihak.',
  },
  {
    icon: Scales,
    title: 'Mediasi Sengketa',
    description: 'Tim mediator profesional menangani sengketa secara netral dan adil dengan SLA respons yang terukur.',
  },
  {
    icon: Wallet,
    title: 'Keamanan Dana',
    description: 'Dana escrow disimpan di rekening terpisah (pooling account) yang diawasi dan tidak dapat diakses sembarangan.',
  },
  {
    icon: Key,
    title: 'Autentikasi 2FA',
    description: 'Two-factor authentication wajib untuk semua aksi kritis — login, penarikan, dan perubahan data penting.',
  },
];

const complianceItems = [
  { label: 'Mengikuti Regulasi Bank Indonesia', status: 'active' },
  { label: 'Proses Perizinan OJK', status: 'pending' },
  { label: 'Standar Keamanan ISO 27001', status: 'active' },
  { label: 'Kebijakan AML/CFT', status: 'active' },
  { label: 'Perlindungan Data Pengguna (UU PDP)', status: 'active' },
];

export default function SecuritySection() {
  return (
    <section className="section-padding-lg bg-muted/30 border-y border-border" id="security">
      <div className="container">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="section-header mb-12"
        >
          <SectionLabel>Keamanan</SectionLabel>
          <h2 className="section-title mb-4">
            Keamanan adalah fondasi kami
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            Setiap lapisan platform Kahade dirancang untuk melindungi dana dan data Anda —
            bukan sekadar fitur, tapi komitmen.
          </p>
        </motion.div>

        {/* Security pillars grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewport}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          {securityPillars.map((pillar) => {
            const PillarIcon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                variants={staggerItem}
                className="card p-6 group hover:border-primary/40 transition-colors duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
                  <PillarIcon
                    className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors duration-300"
                    weight="bold"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-base font-bold mb-2">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Compliance strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="rounded-2xl border border-border bg-background p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Certificate className="w-5 h-5 text-primary-foreground" weight="bold" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold text-base">Status Kepatuhan & Regulasi</p>
                  <p className="text-xs text-muted-foreground">Diperbarui: 15 Januari 2026</p>
                </div>
              </div>
              <ul className="space-y-2">
                {complianceItems.map(({ label, status }) => (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <CheckCircle
                      className={`w-4 h-4 shrink-0 ${status === 'active' ? 'text-success' : 'text-muted-foreground'}`}
                      weight={status === 'active' ? 'fill' : 'regular'}
                      aria-hidden="true"
                    />
                    <span className={status === 'pending' ? 'text-muted-foreground' : ''}>
                      {label}
                      {status === 'pending' && (
                        <span className="ml-2 text-[0.625rem] font-semibold uppercase tracking-wide text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                          Dalam Proses
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0">
              <Link
                href="/security"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Lihat Halaman Keamanan
                <ArrowRight className="w-4 h-4" weight="bold" />
              </Link>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Detail lengkap kebijakan & proses
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
            }