import React from 'react';
import { Shield, Bell, RefreshCw, QrCode, Info, Volume2, LogOut, AlertTriangle, Unlink } from 'lucide-react';
import { ChildDevice, AlertNotification } from '../types';

interface NavbarProps {
  childrenList: ChildDevice[];
  selectedChild: ChildDevice | null;
  onSelectChild: (child: ChildDevice) => void;
  activeTab: 'dashboard' | 'screentime' | 'mirror' | 'camera' | 'location' | 'alerts' | 'gallery' | 'compliance';
  setActiveTab: (tab: 'dashboard' | 'screentime' | 'mirror' | 'camera' | 'location' | 'alerts' | 'gallery' | 'compliance') => void;
  onSignOut: () => void;
  alerts: AlertNotification[];
  onOpenPairing: () => void;
  onOpenPrivacyGuide: () => void;
  onRefreshSync: () => void;
  isSyncing: boolean;
  onRingDevice: () => void;
  isRinging: boolean;
  onDisconnectChild: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  childrenList,
  selectedChild,
  onSelectChild,
  activeTab,
  setActiveTab,
  onSignOut,
  alerts,
  onOpenPairing,
  onOpenPrivacyGuide,
  onRefreshSync,
  isSyncing,
  onRingDevice,
  isRinging,
  onDisconnectChild,
}) => {
  const unreadAlerts = alerts.filter(a => !a.isRead).length;
  const hasSOS = alerts.some(a => a.type === 'sos' && !a.isRead);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      {/* Top Banner if SOS Active */}
      {hasSOS && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 font-semibold mx-auto">
            <AlertTriangle className="w-5 h-5" />
            <span>Peringatan Darurat: Tombol SOS diterima. Segera periksa lokasi perangkat yang terkait.</span>
          </div>
          <button 
            onClick={() => setActiveTab('alerts')}
            className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-50 transition"
          >
            Lihat Detail
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
                  GuardKids
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide">
                  Parental Control
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Sistem Kontrol & Keamanan Keluarga Transparan
              </p>
            </div>
          </div>

          {/* Child Selector & Device Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl p-1">
              {childrenList.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelectChild(child)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedChild?.id === child.id
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${child.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span>{child.name.split(' ')[0]}</span>
                </button>
              ))}

              <button
                onClick={onOpenPairing}
                title="Pasangkan Perangkat Baru"
                className="px-2 py-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded-lg text-xs transition"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions & Info */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onRingDevice}
                disabled={isRinging}
                title="Bunyikan HP Anak untuk mencarinya"
                className={`p-2 rounded-xl border transition ${
                  isRinging
                    ? 'bg-amber-500 text-slate-950 border-amber-400 animate-bounce'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/50'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                onClick={onDisconnectChild}
                disabled={!selectedChild}
                title="Putuskan akun anak"
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 disabled:opacity-40 transition"
              >
                <Unlink className="w-4 h-4" />
              </button>

              <button
                onClick={onRefreshSync}
                title="Sinkronisasi Status Terkini"
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>

              <button
                onClick={() => setActiveTab('alerts')}
                title="Notifikasi & Peringatan"
                className="relative p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                <Bell className="w-4 h-4" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {unreadAlerts}
                  </span>
                )}
              </button>

              <button
                onClick={onOpenPrivacyGuide}
                title="Panduan Privasi & Transparansi"
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-teal-400 transition"
              >
                <Info className="w-4 h-4" />
              </button>

              <button onClick={onSignOut} title="Keluar" className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-red-400 transition">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (When in Parent View) */}
        <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-800 py-2 overflow-x-auto no-scrollbar text-xs sm:text-sm">
            {[
              { id: 'dashboard', label: 'Ikhtisar Perangkat' },
              { id: 'mirror', label: 'Screen Mirroring' },
              { id: 'camera', label: 'Remote Camera' },
              { id: 'gallery', label: 'Galeri & Media' },
              { id: 'screentime', label: 'Waktu Layar & Batas Aplikasi' },
              { id: 'location', label: 'Pelacak Lokasi & Geofence' },
              { id: 'alerts', label: `Notifikasi (${unreadAlerts})` },
              { id: 'compliance', label: 'Kepatuhan & Privasi' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as unknown as typeof activeTab)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-emerald-400 font-semibold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
      </div>
    </header>
  );
};
