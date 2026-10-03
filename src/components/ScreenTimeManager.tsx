import React, { useState } from 'react';
import { Clock, Moon, ShieldCheck, Check, Gamepad2, Youtube, BookOpen, MessageCircle, GraduationCap, Smartphone } from 'lucide-react';
import { ChildDevice } from '../types';

interface ScreenTimeManagerProps {
  child: ChildDevice;
  onUpdateLimit: (minutes: number) => void;
  onUpdateBedtime: (start: string, end: string, enabled: boolean) => void;
  onToggleBlockApp: (appId: string) => void;
  onUpdateAppLimit: (appId: string, limitMinutes: number) => void;
  onUpdateLockMessage: (message: string) => void;
}

export const ScreenTimeManager: React.FC<ScreenTimeManagerProps> = ({
  child, onUpdateLimit, onUpdateBedtime, onToggleBlockApp, onUpdateAppLimit, onUpdateLockMessage,
}) => {
  const [dailyLimit, setDailyLimit] = useState(child.screenTimeLimitMinutes);
  const [bedtimeStart, setBedtimeStart] = useState(child.bedtimeStart);
  const [bedtimeEnd, setBedtimeEnd] = useState(child.bedtimeEnd);
  const [bedtimeEnabled, setBedtimeEnabled] = useState(child.isBedtimeEnabled);
  const [lockMessage, setLockMessage] = useState(child.lockMessage || 'Waktunya istirahat dan menyelesaikan tugas!');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'games' | 'social' | 'education' | 'entertainment'>('all');
  const nativeAppControl = false;
  const filteredApps = child.appUsages.filter((app) => activeCategory === 'all' || app.category === activeCategory);

  const getAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'Gamepad2': return <Gamepad2 className="w-5 h-5 text-indigo-400" />;
      case 'Youtube': return <Youtube className="w-5 h-5 text-red-400" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5 text-amber-400" />;
      case 'MessageCircle': return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      case 'GraduationCap': return <GraduationCap className="w-5 h-5 text-cyan-400" />;
      default: return <Smartphone className="w-5 h-5 text-slate-400" />;
    }
  };

  const handleSaveSchedules = () => {
    onUpdateLimit(dailyLimit);
    onUpdateBedtime(bedtimeStart, bedtimeEnd, bedtimeEnabled);
    onUpdateLockMessage(lockMessage);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const formatHoursMinutes = (mins: number) => {
    const h = Math.floor(mins / 60); const m = mins % 60;
    if (h === 0) return `${m} menit`;
    return `${h} jam ${m > 0 ? `${m} menit` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Clock className="w-6 h-6 text-emerald-400" /><span>Waktu Layar & Kebijakan Companion</span></h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Mengatur batas waktu pada companion web untuk {child.name}. Ini bukan penguncian seluruh sistem operasi.</p>
        </div>
        <button onClick={handleSaveSchedules} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg ${savedSuccess ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
          {savedSuccess ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          <span>{savedSuccess ? 'Tersimpan ke backend' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-white font-bold"><Clock className="w-5 h-5 text-emerald-400" /><span>Batas Companion Harian</span></div><span className="text-base font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">{formatHoursMinutes(dailyLimit)}</span></div>
          <p className="text-xs text-slate-400">Saat batas tercapai, companion web dapat menampilkan layar istirahat/permintaan tambahan waktu. Browser tidak dapat mengunci seluruh HP.</p>
          <input type="range" min={15} max={480} step={15} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="w-full accent-emerald-500" />
          <div className="flex justify-between text-[10px] text-slate-500"><span>15m</span><span>2j</span><span>4j</span><span>8j</span></div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-white font-bold"><Moon className="w-5 h-5 text-indigo-400" /><span>Jadwal Tidur Companion</span></div><button onClick={() => setBedtimeEnabled((v) => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bedtimeEnabled ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-700 text-slate-400'}`}>{bedtimeEnabled ? 'Aktif' : 'Nonaktif'}</button></div>
          <p className="text-xs text-slate-400">Membatasi tampilan companion selama jadwal yang dipilih ketika halaman companion sedang aktif.</p>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">Mulai<input type="time" value={bedtimeStart} onChange={(e) => setBedtimeStart(e.target.value)} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label><label className="text-xs text-slate-400">Selesai<input type="time" value={bedtimeEnd} onChange={(e) => setBedtimeEnd(e.target.value)} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label></div>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div><h2 className="text-base font-bold text-white">Pesan Istirahat</h2><p className="text-xs text-slate-400 mt-1">Pesan ini tampil pada layar companion ketika batas companion diterapkan.</p></div>
        <input value={lockMessage} onChange={(e) => setLockMessage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" maxLength={160} />
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-base font-bold text-white">Data Penggunaan Aplikasi</h2><p className="text-xs text-slate-400 mt-1">Daftar ini hanya akan berisi data yang benar-benar dikirim oleh companion. Browser tidak dapat membaca pemakaian semua aplikasi Android.</p></div><div className="text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">Kontrol native: tidak tersedia</div></div>
        <div className="flex flex-wrap gap-2">{(['all', 'games', 'social', 'education', 'entertainment'] as const).map((cat) => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${activeCategory === cat ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>{cat === 'all' ? 'Semua' : cat}</button>)}</div>
        {filteredApps.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data penggunaan aplikasi dari perangkat ini.</div> : <div className="space-y-2">{filteredApps.map((app) => <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-700/60"><div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">{getAppIcon(app.iconName)}</div><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{app.name}</p><p className="text-[10px] text-slate-500">{app.minutesToday} menit hari ini{app.dailyLimitMinutes ? ` • limit ${app.dailyLimitMinutes}m` : ''}</p></div></div><div className="flex items-center gap-2 shrink-0"><button disabled={!nativeAppControl} onClick={() => onToggleBlockApp(app.id)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-700 text-slate-500 disabled:opacity-60">{app.isBlocked ? 'Diblokir' : 'Blokir'}</button><select disabled={!nativeAppControl} value={app.dailyLimitMinutes || 0} onChange={(e) => onUpdateAppLimit(app.id, Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 disabled:opacity-60"><option value={0}>Tanpa limit</option><option value={30}>30m</option><option value={60}>60m</option><option value={120}>120m</option></select></div></div>)}</div>}
        <p className="text-[11px] text-slate-500">Pemblokiran aplikasi native dan pembacaan Usage Stats penuh harus diimplementasikan oleh companion Android native. Tidak ada perintah web yang berpura-pura berhasil.</p>
      </div>
    </div>
  );
};
