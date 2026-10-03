import React, { useState } from 'react';
import { MapPin, Plus, Navigation, LocateFixed, Shield, ExternalLink, Crosshair } from 'lucide-react';
import type { ChildDevice, SafeZone } from '../types';

interface LocationTrackerProps {
  child: ChildDevice;
  onAddSafeZone: (zone: Omit<SafeZone, 'id' | 'isInside'>) => Promise<void> | void;
  onRefreshLocation: () => Promise<void> | void;
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({ child, onAddSafeZone, onRefreshLocation }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(150);
  const [lat, setLat] = useState(child.currentCoordinates.lat);
  const [lng, setLng] = useState(child.currentCoordinates.lng);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onAddSafeZone({ name, address, radiusMeters: radius, lat, lng, type: 'other' });
    setShowAdd(false); setName(''); setAddress('');
  };
  const maps = `https://www.google.com/maps?q=${child.currentCoordinates.lat},${child.currentCoordinates.lng}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80">
        <div><h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><MapPin className="w-6 h-6 text-sky-400" />Pelacak Lokasi & Geofence</h1><p className="text-xs text-slate-400 mt-1">Koordinat dikirim langsung dari perangkat yang dipasangkan menggunakan Geolocation API.</p></div>
        <div className="flex gap-2"><button onClick={() => void onRefreshLocation()} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5"><LocateFixed className="w-4 h-4" />Segarkan</button><button onClick={() => setShowAdd(true)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" />Zona Aman</button></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-3xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800"><div className="text-xs font-bold text-white flex items-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />Lokasi terakhir</div><span className="text-[10px] text-slate-500">Akurasi ±{Math.round(child.currentCoordinates.accuracy || 0)} m</span></div>
          <div className="mt-4 rounded-2xl bg-slate-950 border border-slate-800 p-5"><div className="text-3xl font-mono font-black text-white tracking-tight">{child.currentCoordinates.lat.toFixed(6)}, {child.currentCoordinates.lng.toFixed(6)}</div><div className="mt-2 text-sm text-slate-300 flex items-start gap-2"><Navigation className="w-4 h-4 text-sky-400 mt-0.5" />{child.currentCoordinates.address}</div><div className="text-[10px] text-slate-600 mt-3">Diperbarui: {child.currentCoordinates.timestamp}</div><a href={maps} target="_blank" rel="noreferrer" className="inline-flex mt-4 items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"><ExternalLink className="w-3.5 h-3.5" />Buka di Google Maps</a></div>
          <div className="mt-5"><div className="text-xs font-bold text-white mb-2">Riwayat lokasi</div><div className="space-y-2 max-h-72 overflow-auto">{child.locationHistory.length ? child.locationHistory.map((p) => <div key={p.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"><div><div className="font-semibold text-white">{p.address}</div><div className="text-[10px] text-slate-500 mt-0.5">{p.time} • baterai {p.battery}%</div></div><a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="text-sky-400"><ExternalLink className="w-4 h-4" /></a></div>) : <div className="text-xs text-slate-600 p-5 text-center">Belum ada riwayat lokasi.</div>}</div></div>
        </div>

        <div className="space-y-3"><div className="bg-slate-900 border border-slate-700 rounded-2xl p-4"><div className="font-bold text-white text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" />Zona Aman</div><div className="space-y-2 mt-3">{child.safeZones.length ? child.safeZones.map((z) => <div key={z.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-800"><div className="flex items-center justify-between"><span className="font-semibold text-white text-xs">{z.name}</span><span className={`text-[10px] px-2 py-0.5 rounded-full border ${z.isInside ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-400 bg-slate-900 border-slate-700'}`}>{z.isInside ? 'Di dalam' : 'Di luar'}</span></div><div className="text-[10px] text-slate-500 mt-1">{z.radiusMeters} m • {z.address}</div></div>) : <div className="text-xs text-slate-600">Belum ada zona.</div>}</div></div><div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-xs text-slate-300"><div className="font-bold text-white flex items-center gap-2"><Crosshair className="w-4 h-4 text-sky-400" />Catatan akurasi</div><p className="mt-2 leading-relaxed">Akurasi GPS bergantung pada sensor, sinyal, dan izin lokasi perangkat. Geofence dihitung dari koordinat yang dilaporkan perangkat.</p></div></div>
      </div>

      {showAdd && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg space-y-4"><div className="flex justify-between items-center"><h3 className="font-bold text-white">Tambah Zona Aman</h3><button type="button" onClick={() => setShowAdd(false)} className="text-slate-400">×</button></div><input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nama zona" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /><input required value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Alamat/deskripsi lokasi" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /><div className="grid grid-cols-3 gap-2"><input type="number" step="any" value={lat} onChange={(e)=>setLat(Number(e.target.value))} placeholder="Latitude" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white" /><input type="number" step="any" value={lng} onChange={(e)=>setLng(Number(e.target.value))} placeholder="Longitude" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white" /><input type="number" min="25" max="5000" value={radius} onChange={(e)=>setRadius(Number(e.target.value))} placeholder="Radius" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white" /></div><button className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Simpan Zona</button></form></div>}
    </div>
  );
};
