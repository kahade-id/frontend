/*
 * KAHADE LICENSES PAGE - PROFESSIONAL REDESIGN
 * 
 * Design Philosophy:
 * - Clean, modern, and professional aesthetic
 * - Fully responsive for Mobile, Tablet, and Desktop
 * - Brand color: var(--color-black)
 */

import { motion } from 'framer-motion';
import { Certificate, Calendar, Printer, Code, Package, FileText } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';

const licenses = [
 { category: 'Frontend Framework', items: [
 { name: 'React', version: '18.2.0', license: 'MIT', url: 'https://github.com/facebook/react' },
 { name: 'Vite', version: '5.0.0', license: 'MIT', url: 'https://github.com/vitejs/vite' },
 { name: 'TypeScript', version: '5.3.0', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript' },
 ]},
 { category: 'UI Components', items: [
 { name: 'Tailwind CSS', version: '3.4.0', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
 { name: 'Radix UI', version: '1.0.0', license: 'MIT', url: 'https://github.com/radix-ui/primitives' },
 { name: 'Framer Motion', version: '10.16.0', license: 'MIT', url: 'https://github.com/framer/motion' },
 { name: 'Phosphor Icons', version: '2.0.0', license: 'MIT', url: 'https://github.com/phosphor-icons/react' },
 ]},
 { category: 'State Management & Routing', items: [
 { name: 'Wouter', version: '3.0.0', license: 'ISC', url: 'https://github.com/molefrog/wouter' },
 { name: 'React Query', version: '5.0.0', license: 'MIT', url: 'https://github.com/TanStack/query' },
 { name: 'Zustand', version: '4.4.0', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
 ]},
 { category: 'Form & Validation', items: [
 { name: 'React Hook Form', version: '7.48.0', license: 'MIT', url: 'https://github.com/react-hook-form/react-hook-form' },
 { name: 'Zod', version: '3.22.0', license: 'MIT', url: 'https://github.com/colinhacks/zod' },
 ]},
 { category: 'Backend & API', items: [
 { name: 'Node.js', version: '20.10.0', license: 'MIT', url: 'https://github.com/nodejs/node' },
 { name: 'Express', version: '4.18.0', license: 'MIT', url: 'https://github.com/expressjs/express' },
 { name: 'Prisma', version: '5.6.0', license: 'Apache-2.0', url: 'https://github.com/prisma/prisma' },
 ]},
 { category: 'Utilities', items: [
 { name: 'date-fns', version: '2.30.0', license: 'MIT', url: 'https://github.com/date-fns/date-fns' },
 { name: 'clsx', version: '2.0.0', license: 'MIT', url: 'https://github.com/lukeed/clsx' },
 { name: 'Axios', version: '1.6.0', license: 'MIT', url: 'https://github.com/axios/axios' },
 ]},
];

const licenseTexts: Record<string, string> = {
 MIT: `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.`,
 'Apache-2.0': `Apache License, Version 2.0

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.`,
 ISC: `ISC License

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.`
};

export default function Licenses() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />
 
 {/* Hero Section */}
 <section className="pt-28 md:pt-32 lg:pt-40 pb-8 md:pb-12 relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-neutral-100)_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" aria-hidden="true" />
 <div className="container relative z-10">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="max-w-3xl"
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Legal
 </span>
 <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-foreground">
 Lisensi Open Source
 </h1>
 <p className="text-base md:text-lg text-muted-foreground mb-4 md:mb-6">
 Kahade dibangun dengan bantuan banyak proyek open source.
 Kami berterima kasih kepada para pengembang dan komunitas di balik alat-alat ini.
 </p>
 <div className="flex flex-wrap items-center gap-4 md:gap-4 text-sm text-muted-foreground">
 <span className="flex items-center gap-2">
 <Calendar className="w-4 h-4" aria-hidden="true" weight="regular" />
 Terakhir diperbarui: 1 Januari 2026
 </span>
 <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-neutral-900" onClick={() => window.print()}>
 <Printer className="w-4 h-4" aria-hidden="true" weight="regular" />
 Cetak
 </Button>
 </div>
 </motion.div>
 </div>
 </section>
 
 {/* License Summary */}
 <section className="py-10 md:py-12 lg:py-16 bg-muted">
 <div className="container">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12 max-w-3xl mx-auto">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border text-center"
 >
 <Package className="w-7 h-7 md:w-10 md:h-10 mx-auto text-foreground mb-2 md:mb-4" aria-hidden="true" weight="bold" />
 <div className="text-xl md:text-3xl font-bold mb-0.5 md:mb-1 text-foreground">
 {licenses.reduce((acc, cat) => acc + cat.items.length, 0)}
 </div>
 <div className="text-[10px] md:text-sm text-muted-foreground">Paket</div>
 </motion.div>
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: 0.1 }}
 className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border text-center"
 >
 <Code className="w-7 h-7 md:w-10 md:h-10 mx-auto text-foreground mb-2 md:mb-4" aria-hidden="true" weight="bold" />
 <div className="text-xl md:text-3xl font-bold mb-0.5 md:mb-1 text-foreground">{licenses.length}</div>
 <div className="text-[10px] md:text-sm text-muted-foreground">Kategori</div>
 </motion.div>
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: 0.2 }}
 className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border text-center"
 >
 <FileText className="w-7 h-7 md:w-10 md:h-10 mx-auto text-foreground mb-2 md:mb-4" aria-hidden="true" weight="bold" />
 <div className="text-xl md:text-3xl font-bold mb-0.5 md:mb-1 text-foreground">3</div>
 <div className="text-[10px] md:text-sm text-muted-foreground">Jenis Lisensi</div>
 </motion.div>
 </div>
 
 {/* Package List */}
 <div className="space-y-6 md:space-y-8">
 {licenses.map((category, catIndex) => (
 <motion.div
 key={category.category}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: catIndex * 0.05 }}
 >
 <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-foreground">{category.category}</h2>
 <div className="bg-card rounded-xl md:rounded-2xl border border-border overflow-hidden">
 {/* Mobile Card View */}
 <div className="md:hidden divide-y divide-neutral-200">
 {category.items.map((item) => (
 <div key={item.name} className="p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="font-bold text-sm text-foreground">{item.name}</span>
 <span className="px-2 py-0.5 rounded-lg bg-muted text-foreground text-[10px] font-semibold">
 {item.license}
 </span>
 </div>
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>v{item.version}</span>
 <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold hover:underline">
 Lihat →
 </a>
 </div>
 </div>
 ))}
 </div>
 
 {/* Desktop Table View */}
 <table className="w-full hidden md:table">
 <thead className="bg-muted">
 <tr>
 <th className="text-left p-4 font-bold text-sm text-foreground">Paket</th>
 <th className="text-left p-4 font-bold text-sm text-foreground">Versi</th>
 <th className="text-left p-4 font-bold text-sm text-foreground">Lisensi</th>
 <th className="text-right p-4 font-bold text-sm text-foreground">Tautan</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-200">
 {category.items.map((item) => (
 <tr key={item.name} className="hover:bg-muted transition-colors">
 <td className="p-4 font-semibold text-sm text-foreground">{item.name}</td>
 <td className="p-4 text-sm text-muted-foreground">{item.version}</td>
 <td className="p-4">
 <span className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-semibold">
 {item.license}
 </span>
 </td>
 <td className="p-4 text-right">
 <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline text-sm font-semibold">
 Lihat →
 </a>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </section>
 
 {/* License Texts */}
 <section className="py-10 md:py-12 lg:py-16">
 <div className="container">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="text-center mb-8 md:mb-12"
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Teks Lengkap
 </span>
 <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-foreground">Teks Lisensi</h2>
 <p className="text-sm md:text-base text-muted-foreground">
 Teks lengkap lisensi open source yang digunakan dalam proyek ini.
 </p>
 </motion.div>
 
 <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
 {Object.entries(licenseTexts).map(([name, text], index) => (
 <motion.div
 key={name}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.1 }}
 className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6"
 >
 <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4 text-foreground">Lisensi {name}</h3>
 <pre className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-2 md:p-4 rounded-xl overflow-x-auto">
 {text}
 </pre>
 </motion.div>
 ))}
 </div>
 </div>
 </section>
 
 {/* Acknowledgments */}
 <section className="py-10 md:py-12 lg:py-16 bg-black relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20" aria-hidden="true" />
 <div className="container relative z-10">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="text-center max-w-2xl mx-auto"
 >
 <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Ucapan Terima Kasih</h2>
 <p className="text-sm md:text-base text-white/70 mb-4 md:mb-6">
 Kami menyampaikan terima kasih kepada seluruh pemelihara dan kontributor open source
 yang karyanya memungkinkan proyek seperti Kahade. Dedikasi Anda dalam membangun dan
 berbagi perangkat lunak berkualitas bermanfaat bagi komunitas pengembang secara luas.
 </p>
 <p className="text-xs md:text-sm text-white/50">
 Jika Anda merasa kami melewatkan atribusi atau memiliki pertanyaan tentang penggunaan
 perangkat lunak open source, silakan hubungi kami di{' '}
 <a href="mailto:legal@kahade.id" className="text-white hover:underline">
 legal@kahade.id
 </a>
 </p>
 </motion.div>
 </div>
 </section>
 
 <Footer />
 </div>
 );
}