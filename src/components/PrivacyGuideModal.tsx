import React from 'react';
import { AlertCircle, Camera, CheckCircle2, MapPin, Lock, ShieldCheck, X } from 'lucide-react';

interface PrivacyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyGuideModal: React.FC<PrivacyGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
  <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 relative">
      <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-white p-2" aria-label="Tutup">
        <X className="w-5 h-5" />
      </button>

      <div>
        <span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-3 py-1 rounded-full font-bold">Transparansi & Keamanan</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-2">Cara Kerja GuardKids Production</h2>
        <p className="text-xs text-slate-400 mt-1">Fitur yang benar-benar berjalan pada companion web ditampilkan apa adanya; kemampuan native Android yang tidak tersedia tidak disimulasikan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> Fitur nyata</div>
          <div className="space-y-3 text-slate-300">
            <p className="flex gap-2"><MapPin className="w-4 h-4 text-emerald-400 shrink-0" /> Lokasi memakai Browser Geolocation API setelah perangkat memberikan izin, lalu dibandingkan dengan radius zona aman yang tersimpan di backend.</p>
            <p className="flex gap-2"><Camera className="w-4 h-4 text-emerald-400 shrink-0" /> Kamera dan screen sharing memakai izin browser dan persetujuan anak yang terlihat di layar.</p>
            <p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Media yang diunggah tersimpan di Supabase Storage privat dan dibaca sesuai kebijakan akses.</p>
            <p className="flex gap-2"><Lock className="w-4 h-4 text-emerald-400 shrink-0" /> Data keluarga dipisahkan dengan Supabase Auth dan Row Level Security.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm"><AlertCircle className="w-4 h-4" /> Batas companion web</div>
          <div className="space-y-3 text-slate-300">
            <p>Browser tidak dapat membaca daftar semua aplikasi Android atau statistik penggunaan sistem secara penuh.</p>
            <p>Browser tidak dapat mengunci seluruh OS, memblokir aplikasi native lain, atau menyalakan kamera/mikrofon secara diam-diam.</p>
            <p>Kontrol aplikasi native dan manajemen perangkat memerlukan companion Android native dengan API dan izin sistem yang sesuai.</p>
            <p>Ikon companion tidak disembunyikan dari launcher/browser. Tidak ada mode pengawasan stealth.</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs sm:text-sm">
        <h3 className="font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-400" /> Persetujuan & audit</h3>
        <p className="text-slate-400 leading-relaxed">Permintaan kamera dan berbagi layar selalu membutuhkan tindakan pada perangkat anak. Perintah perangkat memiliki status acknowledgement sehingga parent dapat membedakan perintah yang diterima, selesai, atau ditolak.</p>
        <p className="text-slate-400 leading-relaxed">GuardKids menyimpan pairing code dalam bentuk hash dengan masa berlaku singkat. Source code tidak mengandung sample device, URL kamera palsu, atau simulator gerakan.</p>
      </div>

      <div className="pt-2 flex justify-end">
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs">Saya Mengerti</button>
      </div>
    </div>
  </div>
);
};
