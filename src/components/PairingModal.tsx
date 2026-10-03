import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Smartphone, CheckCircle2, ArrowRight, X, Copy, Check, RefreshCw } from 'lucide-react';
import type { ChildDevice } from '../types';
import { createChild, renewPairingCode } from '../lib/guardkidsApi';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChild: ChildDevice | null;
  parentId: string;
  onChildCreated: (child: ChildDevice, pairingCode: string) => void;
  onPairingCode: (childId: string, pairingCode: string) => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({ isOpen, onClose, selectedChild, parentId, onChildCreated, onPairingCode }) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(10);
  const [deviceModel, setDeviceModel] = useState('');
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<1|2>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) { setShowForm(false); setError(null); return; }
    setStep(1); setCode(''); setQr(''); setCopied(false);
  }, [isOpen, selectedChild?.id]);

  useEffect(() => {
    if (code) QRCode.toDataURL(`${childUrl}&pairing=${encodeURIComponent(code)}`, { width: 220, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [code]);

  if (!isOpen) return null;

  const generateForSelected = async () => {
    if (!selectedChild) return;
    setBusy(true); setError(null);
    try {
      const newCode = await renewPairingCode(selectedChild.id);
      setCode(newCode); setStep(2); onPairingCode(selectedChild.id, newCode);
    } catch (e:any) { setError(e?.message || 'Gagal membuat kode pemasangan.'); }
    finally { setBusy(false); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const result = await createChild(parentId, { name, age, deviceModel });
      onChildCreated(result.child, result.pairingCode); setCode(result.pairingCode); setStep(2); setShowForm(false); onPairingCode(result.child.id, result.pairingCode);
      setName(''); setDeviceModel('');
    } catch (err:any) { setError(err?.message || 'Gagal menambah perangkat.'); }
    finally { setBusy(false); }
  };

  const copy = async () => { if (!code) return; await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false), 1600); };
  const childUrl = `${window.location.origin}${window.location.pathname}?mode=child`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      {showForm ? <form onSubmit={create} className="space-y-4"><div><h2 className="text-xl font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-emerald-400" />Tambah perangkat anak</h2><p className="text-xs text-slate-400 mt-1">Profil baru akan tersimpan ke database dan mendapat satu kode pemasangan sementara.</p></div><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nama anak" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /><div className="grid grid-cols-2 gap-3"><input type="number" min="4" max="18" required value={age} onChange={e=>setAge(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /><input required value={deviceModel} onChange={e=>setDeviceModel(e.target.value)} placeholder="Model HP" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /></div>{error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-xs">{error}</div>}<div className="flex gap-2"><button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Kembali</button><button disabled={busy} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">{busy?'Menyimpan…':'Simpan & buat kode'}</button></div></form> : <>
        <div><span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Pemasangan perangkat</span><h2 className="text-xl font-bold text-white mt-2">{selectedChild ? `Pasangkan ${selectedChild.name}` : 'Pasangkan HP Anak'}</h2><p className="text-xs text-slate-400 mt-1">Kode hanya berlaku sementara dan hanya bisa digunakan satu perangkat.</p></div>
        <div className="flex items-center gap-2 mt-5 text-xs"><button onClick={()=>setStep(1)} className={`flex items-center gap-1.5 ${step===1?'text-emerald-400 font-bold':'text-slate-500'}`}><span className="w-5 h-5 rounded-full bg-slate-800 inline-flex items-center justify-center">1</span>Siapkan perangkat</button><ArrowRight className="w-3.5 h-3.5 text-slate-600" /><button onClick={()=>setStep(2)} className={`flex items-center gap-1.5 ${step===2?'text-emerald-400 font-bold':'text-slate-500'}`}><span className="w-5 h-5 rounded-full bg-slate-800 inline-flex items-center justify-center">2</span>Kode</button></div>
        {step===1 ? <div className="space-y-4 mt-5"><div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 text-xs text-slate-300 leading-relaxed">Buka alamat aplikasi GuardKids pada HP anak dengan <span className="font-mono text-emerald-300 break-all">?mode=child</span>, lalu izinkan lokasi, kamera, dan screen sharing saat diminta.</div><div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500">URL companion: <span className="text-slate-300 break-all">{childUrl}</span></div><button disabled={!selectedChild || busy} onClick={()=>void generateForSelected()} className="w-full py-3 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2"><QrCode className="w-4 h-4" />{busy?'Membuat kode…':'Buat / perbarui kode pemasangan'}</button><button onClick={()=>setShowForm(true)} className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold">Tambah profil anak baru</button></div> : <div className="mt-5 text-center space-y-4"><div className="w-48 h-48 mx-auto bg-white rounded-2xl p-2 shadow-xl flex items-center justify-center">{qr ? <img src={qr} alt="QR pairing GuardKids" className="w-full h-full" /> : <QrCode className="w-12 h-12 text-slate-400" />}</div><div className="text-3xl tracking-[0.25em] font-black font-mono text-white">{code || '—'}</div><div className="flex justify-center gap-2"><button onClick={()=>void copy()} disabled={!code} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex gap-1.5 items-center">{copied?<Check className="w-4 h-4 text-emerald-400" />:<Copy className="w-4 h-4" />}{copied?'Tersalin':'Salin kode'}</button><button onClick={()=>void generateForSelected()} disabled={!selectedChild || busy} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex gap-1.5 items-center"><RefreshCw className="w-4 h-4" />Kode baru</button></div><div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left text-xs text-emerald-200 flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5" /><span>Setelah HP anak berhasil terhubung, kode lama tidak bisa dipakai lagi.</span></div>{error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-xs">{error}</div>}</div>}
      </>}
    </div></div>
  );
};
