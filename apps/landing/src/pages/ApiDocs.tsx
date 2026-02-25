import { useState } from 'react';
import { CopySimple, Check, Code, LinkSimple, Key, CaretRight } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';
import { PageHero } from '../components/common/PageHero';

const nav = [
  { section: 'Pengenalan', items: ['Ikhtisar', 'Autentikasi', 'Rate Limits'] },
  { section: 'Transaksi', items: ['Buat Transaksi', 'Ambil Transaksi', 'Update Status', 'Batalkan'] },
  { section: 'Pembayaran', items: ['Virtual Account', 'QRIS', 'Konfirmasi Manual'] },
  { section: 'LinkSimples', items: ['Setup LinkSimple', 'Event Types', 'Verifikasi Signature'] },
  { section: 'Referensi', items: ['Status Codes', 'Error Codes', 'Sandbox'] },
];

const codeExample = `// Buat transaksi baru
const response = await fetch('https://api.kahade.id/v1/transactions', {
 method: 'POST',
 headers: {
 'Authorization': 'Bearer YOUR_API_KEY',
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 title: 'Pembelian Laptop Gaming',
 amount: 15000000,
 currency: 'IDR',
 buyer_email: 'pembeli@email.com',
 seller_email: 'penjual@email.com',
 description: 'Laptop ASUS ROG, kondisi baru, garansi resmi',
 deadline_days: 14,
 }),
});

const transaction = await response.json();
// Gunakan response ini untuk update UI aplikasi`;

const responseExample = `{
 "id": "KHD-2025-001234",
 "status": "pending_payment",
 "title": "Pembelian Laptop Gaming",
 "amount": 15000000,
 "currency": "IDR",
 "fee": 375000,
 "net_amount": 14625000,
 "buyer": {
 "email": "pembeli@email.com",
 "verified": true
 },
 "seller": {
 "email": "penjual@email.com",
 "verified": true
 },
 "payment": {
 "virtual_account": "7008 1234 5678 9012",
 "expired_at": "2025-01-20T17:00:00Z"
 },
 "created_at": "2025-01-15T10:30:00Z"
}`;

function CodeBlock({ code, lang = 'javascript' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800">
        <span className="text-xs text-neutral-400 font-medium">{lang}</span>
        <Button variant="ghost" size="sm" onClick={copy} className="h-8 px-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800">
          {copied ? <Check size={14} className="text-green-400" /> : <CopySimple size={14} />}
          {copied ? 'Disalin!' : 'Salin'}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-neutral-100">{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocs() {
  const [activeSection, setActiveSection] = useState('Buat Transaksi');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <aside className="hidden lg:block w-64 fixed landing-sticky-top bottom-0 left-0 overflow-y-auto border-r border-border bg-muted/20 pb-16">
          <div className="px-4 pt-6">
            {nav.map(({ section, items }) => (
              <div key={section} className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{section}</p>
                <div className="space-y-1">
                  {items.map(item => (
                    <Button
                      key={item}
                      type="button"
                      variant={activeSection === item ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveSection(item)}
                      className={`w-full justify-start text-left h-8 ${activeSection === item ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {activeSection === item ? <CaretRight size={12} /> : null}
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="lg:ml-64 flex-1 min-h-screen">
          <PageHero
            eyebrow="API Documentation"
            title="Kahade Developer API"
            description="Integrasikan sistem escrow Kahade ke dalam platform Anda dengan REST API yang sederhana dan powerful."
            icon={<Code size={20} className="text-primary" />}
            chips={[{ label: 'v1.0 Stable', tone: 'success' }, { label: 'REST API', tone: 'info' }, { label: 'JSON' }]}
          />

          <div className="max-w-[1100px] mx-auto px-6 pb-16">
            <section className="mb-12" id="auth">
              <h2 className="text-2xl font-bold mb-6">Autentikasi</h2>
              <p className="text-muted-foreground mb-4">Semua permintaan API harus menyertakan API Key Anda dalam header <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">Authorization</code>.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Key size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">Jangan pernah menyertakan API Key di frontend atau kode publik. Gunakan hanya di server-side.</p>
              </div>
              <CodeBlock code={`Authorization: Bearer kh_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} lang="HTTP Header" />
            </section>

            <section className="mb-12" id="create-transaction">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-bold font-mono">POST</span>
                <h2 className="text-2xl font-bold">Buat Transaksi</h2>
              </div>
              <p className="text-muted-foreground mb-6">Membuat transaksi escrow baru antara pembeli dan penjual.</p>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold mb-3 text-muted-foreground">REQUEST</p>
                  <CodeBlock code={codeExample} lang="JavaScript" />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-3 text-muted-foreground">RESPONSE 201</p>
                  <CodeBlock code={responseExample} lang="JSON" />
                </div>
              </div>
            </section>

            <section className="mb-12" id="webhooks">
              <div className="flex items-center gap-3 mb-6">
                <LinkSimple size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">LinkSimples</h2>
              </div>
              <p className="text-muted-foreground mb-6">Kahade akan mengirimkan notifikasi ke URL webhook Anda saat status transaksi berubah.</p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { event: 'transaction.created', desc: 'Transaksi baru dibuat' },
                  { event: 'payment.received', desc: 'Pembayaran dari pembeli diterima' },
                  { event: 'transaction.completed', desc: 'Transaksi selesai, dana dicairkan' },
                  { event: 'dispute.opened', desc: 'Sengketa dibuka oleh salah satu pihak' },
                ].map(({ event, desc }) => (
                  <div key={event} className="card p-4">
                    <code className="text-sm font-mono text-primary">{event}</code>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-muted/40 rounded-2xl p-8" id="sandbox">
              <h2 className="text-2xl font-bold mb-3">Sandbox Environment</h2>
              <p className="text-muted-foreground mb-4">Test integrasi Anda tanpa uang nyata menggunakan sandbox environment kami.</p>
              <div className="flex gap-3 flex-wrap">
                <code className="bg-background border border-border px-3 py-2 rounded-lg text-sm font-mono">https://sandbox.api.kahade.id/v1</code>
                <span className="px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-sm font-medium">Prefix key: kh_test_</span>
              </div>
            </section>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
