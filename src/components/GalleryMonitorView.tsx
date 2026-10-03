import React, { useState } from 'react';
import { Image, Video, Search, Download, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import type { ChildDevice, MediaItem } from '../types';
import { signedMediaUrl } from '../lib/guardkidsApi';

interface GalleryMonitorViewProps { child: ChildDevice; onRefresh: () => Promise<void> | void; }

export const GalleryMonitorView: React.FC<GalleryMonitorViewProps> = ({ child, onRefresh }) => {
  const [category, setCategory] = useState<'all'|'camera'|'screenshot'|'whatsapp'|'download'>('all');
  const [type, setType] = useState<'all'|'image'|'video'>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = child.galleryItems || [];
  const filtered = items.filter((item) => (category === 'all' || item.category === category) && (type === 'all' || (item.mediaType || 'image') === type) && `${item.title} ${item.filename}`.toLowerCase().includes(q.toLowerCase()));
  const photos = items.filter(i => i.mediaType !== 'video').length;
  const videos = items.filter(i => i.mediaType === 'video').length;

  const refresh = async () => { setBusy(true); try { await onRefresh(); } finally { setBusy(false); } };
  const download = async (item: MediaItem) => {
    const url = item.videoUrl || item.imageUrl || await signedMediaUrl((item as any).storagePath || '');
    const a = document.createElement('a'); a.href = url; a.download = item.filename; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80"><div><h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Image className="w-6 h-6 text-emerald-400" />Galeri & Media</h1><p className="text-xs text-slate-400 mt-1">Media benar-benar diambil dari Storage project. Tidak ada file contoh.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5"><RefreshCw className={`w-4 h-4 ${busy?'animate-spin':''}`} />Segarkan</button></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="p-4 rounded-2xl bg-slate-900 border border-slate-800"><div className="text-xs text-slate-500">Total media</div><div className="text-lg font-black text-white mt-1">{items.length}</div></div><div className="p-4 rounded-2xl bg-slate-900 border border-slate-800"><div className="text-xs text-slate-500">Foto</div><div className="text-lg font-black text-white mt-1">{photos}</div></div><div className="p-4 rounded-2xl bg-slate-900 border border-slate-800"><div className="text-xs text-slate-500">Video</div><div className="text-lg font-black text-white mt-1">{videos}</div></div></div>
      <div className="flex flex-col sm:flex-row gap-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800"><div className="flex gap-1">{(['all','image','video'] as const).map(v => <button key={v} onClick={()=>setType(v)} className={`px-3 py-1.5 rounded-lg text-[11px] ${type===v?'bg-sky-600 text-white font-bold':'bg-slate-800 text-slate-400'}`}>{v==='all'?`Semua (${items.length})`:v==='image'?`Foto (${photos})`:`Video (${videos})`}</button>)}</div><div className="flex gap-1 overflow-x-auto">{(['all','camera','screenshot','whatsapp','download'] as const).map(v => <button key={v} onClick={()=>setCategory(v)} className={`px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap ${category===v?'bg-emerald-600 text-white font-bold':'bg-slate-800 text-slate-400'}`}>{v==='all'?'Semua Folder':v}</button>)}</div><div className="relative sm:ml-auto"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari media…" className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white w-full sm:w-64" /></div></div>
      {filtered.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(item => <div key={item.id} onClick={()=>setSelected(item)} className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/40 cursor-pointer"><div className="aspect-video bg-slate-950 relative"><img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />{item.mediaType==='video' && <div className="absolute inset-0 flex items-center justify-center"><span className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center"><Video className="w-5 h-5" /></span></div>}<span className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold ${item.aiSafetyScore==='safe'?'bg-emerald-500 text-slate-950':item.aiSafetyScore==='flagged'?'bg-red-500 text-white':'bg-amber-500 text-slate-950'}`}>{item.aiSafetyScore==='safe'?'Aman':item.aiSafetyScore==='flagged'?'Perlu diperiksa':'Belum dianalisis'}</span></div><div className="p-3"><div className="font-bold text-sm text-white line-clamp-1">{item.title}</div><div className="text-[10px] text-slate-500 mt-1">{item.filename} • {item.fileSize}</div><div className="flex items-center justify-between mt-3"><span className="text-[10px] text-slate-500">{item.aiSafetyTag}</span><button onClick={(e)=>{e.stopPropagation();void download(item)}} className="p-1.5 rounded-lg bg-slate-800 text-slate-300"><Download className="w-3.5 h-3.5" /></button></div></div></div>)}</div> : <div className="p-10 text-center rounded-2xl border border-dashed border-slate-800 text-slate-600 text-sm">Belum ada media yang tersinkronisasi.</div>}
      {busy && <div className="fixed bottom-5 right-5 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 shadow-xl flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-emerald-400" />Memproses…</div>}
      {selected && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={()=>setSelected(null)}><div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><div className="font-bold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" />{selected.title}</div><button onClick={()=>setSelected(null)} className="text-slate-400">×</button></div><div className="aspect-video bg-black rounded-2xl overflow-hidden">{selected.mediaType==='video'?<video src={selected.videoUrl} poster={selected.imageUrl} controls playsInline className="w-full h-full" />:<img src={selected.imageUrl} alt={selected.title} className="w-full h-full object-contain" />}</div><div className="mt-4 p-4 rounded-2xl bg-slate-800/70 text-xs text-slate-300"><div className="font-bold text-white">Status media</div><div className="mt-1">File tersinkronisasi dari perangkat pasangan dan tersimpan di Storage privat keluarga.</div></div></div></div>}
    </div>
  );
};
