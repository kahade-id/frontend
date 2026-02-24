import { useMemo, useState } from 'react';
import { MagnifyingGlass, PaperclipHorizontal, PaperPlaneTilt } from '@phosphor-icons/react';

const conversations = [
 { id: 1, name: '@seller_081', preview: 'Sudah saya kirim via JNE', time: '2 jam lalu', unread: 1, tx: '#KHD-2451', active: true },
 { id: 2, name: 'Kahade Support', preview: 'Tiket #T-089 telah selesai', time: 'Kemarin', unread: 0, tx: 'Support', active: false },
 { id: 3, name: '@jasa_design', preview: 'File sudah saya upload', time: '3 hari lalu', unread: 0, tx: '#KHD-2449', active: false },
];

const initialMessages = [
 { text: 'Barang sudah saya kirim via JNE', time: '19 Feb 09:15', own: false },
 { text: 'No resi: JNE-2024-XXXXX', time: '19 Feb 09:16', own: false },
 { text: 'Terima kasih, akan saya cek', time: '19 Feb 10:30', own: true },
 { text: 'Barang sudah sampai, kondisi baik 👍', time: '20 Feb 14:00', own: true },
];

export default function Messages() {
 const [activeConv, setActiveConv] = useState(1);
 const [msg, setMsg] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [messages, setMessages] = useState(initialMessages);

 const filteredConversations = useMemo(() => conversations.filter((c) => {
  const query = searchQuery.toLowerCase();
  return c.name.toLowerCase().includes(query) || c.preview.toLowerCase().includes(query) || c.tx.toLowerCase().includes(query);
 }), [searchQuery]);

 const conv = conversations.find(c => c.id === activeConv);

 const handleSend = () => {
  const trimmed = msg.trim();
  if (!trimmed) return;
  setMessages((prev) => [...prev, { text: trimmed, own: true, time: 'Baru saja' }]);
  setMsg('');
 };

 return (
 <div className="h-[calc(100vh-64px)] flex">
 <div className="w-72 border-r border-border flex flex-col shrink-0">
 <div className="p-4 border-b border-border">
 <div className="relative">
 <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <label htmlFor="search-conversation" className="sr-only">Cari percakapan</label>
 <input id="search-conversation" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari percakapan..." className="w-full h-9 pl-9 pr-3 rounded-xl bg-muted text-sm focus:outline-none" />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto">
 {filteredConversations.map(c => (
 <button key={c.id} onClick={() => setActiveConv(c.id)} className={`w-full text-left p-4 border-b border-border hover:bg-muted/50 transition-colors ${activeConv === c.id ? 'bg-muted/50' : ''}`}>
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${c.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
 {c.name.charAt(1).toUpperCase()}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1">
 {c.active && <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
 <p className="font-semibold text-sm truncate">{c.name}</p>
 </div>
 <p className="text-xs text-muted-foreground">{c.tx}</p>
 </div>
 </div>
 <div className="text-right shrink-0">
 <p className="text-xs text-muted-foreground">{c.time}</p>
 {c.unread > 0 && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold mt-1">{c.unread}</span>}
 </div>
 </div>
 <p className="text-xs text-muted-foreground mt-1.5 truncate pl-12">{c.preview}</p>
 </button>
 ))}
 </div>
 </div>

 <div className="flex-1 flex flex-col">
 <div className="p-4 border-b border-border flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
 {conv?.name.charAt(1).toUpperCase()}
 </div>
 <div>
 <p className="font-semibold text-sm">{conv?.name}</p>
 <p className="text-xs text-muted-foreground">Transaksi {conv?.tx}</p>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-3">
 {messages.map((m, i) => (
 <div key={i} className={`flex ${m.own ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
 {m.text}
 <span className={`text-[0.625rem] block text-right mt-1 ${m.own ? 'opacity-60' : 'text-muted-foreground'}`}>{m.time}</span>
 </div>
 </div>
 ))}
 </div>

 <div className="p-4 border-t border-border flex items-center gap-3">
 <button type="button" className="p-2 rounded-xl hover:bg-muted transition-colors shrink-0" aria-label="Lampirkan file (segera hadir)"><PaperclipHorizontal size={20} className="text-muted-foreground" /></button>
 <label htmlFor="compose-message" className="sr-only">Tulis pesan</label>
 <input id="compose-message" type="text" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Tulis pesan..." className="flex-1 h-10 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
 <button type="button" onClick={handleSend} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors" aria-label="Kirim pesan">
 <PaperPlaneTilt size={18} />
 </button>
 </div>
 </div>
 </div>
 );
}
