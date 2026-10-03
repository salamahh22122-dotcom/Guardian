import React from 'react';
import { 
  Smartphone, Battery, BatteryCharging, Wifi, Lock, Unlock, Volume2, 
  MapPin, Clock, Moon, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, ArrowUpRight, Flame, ShieldAlert, Tv, Camera,
  Gamepad2, Youtube, BookOpen, MessageCircle, GraduationCap
} from 'lucide-react';
import { ChildDevice, AlertNotification, TimeRequest } from '../types';

interface ParentDashboardProps {
  child: ChildDevice;
  alerts: AlertNotification[];
  timeRequests: TimeRequest[];
  onToggleLock: () => void;
  onRingDevice: () => void;
  isRinging: boolean;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onToggleBlockApp: (appId: string) => void;
  onNavigateTab: (tab: 'dashboard' | 'screentime' | 'mirror' | 'camera' | 'location' | 'alerts' | 'compliance') => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  child,
  alerts,
  timeRequests,
  onToggleLock,
  onRingDevice,
  isRinging,
  onApproveRequest,
  onRejectRequest,
  onToggleBlockApp,
  onNavigateTab,
}) => {
  const isLocked = child.screenStatus !== 'unlocked';
  const remainingMinutes = Math.max(0, child.screenTimeLimitMinutes - child.todayScreenTimeMinutes);
  const percentUsed = Math.min(100, Math.round((child.todayScreenTimeMinutes / child.screenTimeLimitMinutes) * 100));

  const formatHoursMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} menit`;
    return `${h}j ${m > 0 ? `${m}m` : ''}`;
  };

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

  const pendingChildRequests = timeRequests.filter(r => r.childId === child.id && r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Device Status Bar */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${child.avatarColor} flex items-center justify-center text-white font-extrabold text-xl shadow-lg ring-4 ring-slate-700/50`}>
              {child.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{child.name}</h1>
                <span className="text-xs bg-slate-700/80 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                  {child.age} Tahun
                </span>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${child.isOnline ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 bg-slate-700/40 border border-slate-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${child.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {child.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span>{child.deviceModel}</span>
                <span>•</span>
                <span>{child.osVersion}</span>
              </p>
            </div>
          </div>

          {/* Device Telemetry Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Battery */}
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
              {child.isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className={`w-4 h-4 ${child.batteryLevel <= 20 ? 'text-red-400' : 'text-emerald-400'}`} />
              )}
              <span className="font-semibold text-white">{child.batteryLevel > 0 ? `${child.batteryLevel}%` : '—'}</span>
              {child.isCharging && <span className="text-[10px] text-emerald-400">Mengisi daya</span>}
            </div>

            {/* Network */}
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
              <Wifi className="w-4 h-4 text-sky-400" />
              <span className="font-medium text-slate-300">
                {child.networkType === 'WiFi' ? (child.wifiSSID || 'WiFi') : `Seluler ${child.networkType}`}
              </span>
            </div>

            {/* Lock Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              isLocked 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'Companion Dibatasi' : 'Companion Aktif'}</span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <button
            onClick={onToggleLock}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition shadow-sm ${
              isLocked
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{isLocked ? 'Buka Companion' : 'Kunci Companion'}</span>
          </button>

          <button
            onClick={() => onNavigateTab('camera')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span>Kamera Jarak Jauh</span>
          </button>

          <button
            onClick={() => onNavigateTab('mirror')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
          >
            <Tv className="w-4 h-4" />
            <span>Screen Mirror</span>
          </button>

          <button
            onClick={onRingDevice}
            disabled={isRinging}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border transition ${
              isRinging
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold animate-pulse'
                : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white'
            }`}
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>{isRinging ? 'Berdering...' : 'Bunyikan Companion'}</span>
          </button>

          <button
            onClick={() => onNavigateTab('location')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white transition"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Cek Lokasi</span>
          </button>

          <button
            onClick={() => onNavigateTab('screentime')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white transition"
          >
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Waktu Layar</span>
          </button>
        </div>
      </div>

      {/* Pending Requests Alert from Child */}
      {pendingChildRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-3">
            <Flame className="w-4 h-4" />
            <span>Permintaan Tambahan Waktu dari {child.name}</span>
          </div>

          <div className="space-y-3">
            {pendingChildRequests.map((req) => (
              <div key={req.id} className="bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <span>Minta +{req.requestedMinutes} Menit {req.appName ? `untuk ${req.appName}` : 'Waktu Layar'}</span>
                    <span className="text-xs text-slate-400 font-normal">({req.timestamp})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 italic">
                    &quot;{req.reason}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onApproveRequest(req.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui (+{req.requestedMinutes}m)</span>
                  </button>
                  <button
                    onClick={() => onRejectRequest(req.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Screen Time Overview & Location Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Screen Time Progress Card */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>Waktu Layar Hari Ini</span>
              </div>
              <button
                onClick={() => onNavigateTab('screentime')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Kelola</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-5 text-center">
              <div className="text-3xl sm:text-4xl font-black text-white">
                {formatHoursMinutes(child.todayScreenTimeMinutes)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                dari batas harian {formatHoursMinutes(child.screenTimeLimitMinutes)}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mt-5 space-y-2">
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed >= 90 ? 'bg-red-500' : percentUsed >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{percentUsed}% Terpakai</span>
                <span className={remainingMinutes === 0 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                  Tersisa {formatHoursMinutes(remainingMinutes)}
                </span>
              </div>
            </div>
          </div>

          {/* Bedtime schedule reminder */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs bg-slate-900/50 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-slate-300">
              <Moon className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="font-semibold text-white">Jadwal Waktu Tidur</p>
                <p className="text-[11px] text-slate-400">{child.bedtimeStart} - {child.bedtimeEnd} WIB</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {child.isBedtimeEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        {/* Live Location Snapshot Card */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <MapPin className="w-5 h-5 text-teal-400" />
                <span>Lokasi Terkini</span>
              </div>
              <button
                onClick={() => onNavigateTab('location')}
                className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                <span>Buka Peta</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stylized mini-map visualization */}
            <div className="mt-4 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-3 relative h-36 flex flex-col justify-between">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:16px_16px]" />
              
              <div className="relative z-10 flex items-center justify-between text-[11px]">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                  ✓ Dalam Zona Aman (Rumah)
                </span>
                <span className="text-slate-400">{child.currentCoordinates.timestamp}</span>
              </div>

              <div className="relative z-10 my-auto flex items-center justify-center">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/30 animate-ping absolute -inset-0" />
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-lg relative">
                    <MapPin className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="relative z-10 text-[11px] text-slate-300 truncate font-medium bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-700">
                {child.currentCoordinates.address}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <span>Akurasi GPS: ~{child.currentCoordinates.accuracy} meter</span>
            <button
              onClick={() => onNavigateTab('location')}
              className="text-teal-400 hover:underline font-semibold"
            >
              Lihat Riwayat Perjalanan
            </button>
          </div>
        </div>

        {/* Protection Health & Permissions */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Status Companion Web</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${child.isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                {child.isOnline ? 'Terhubung' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Kemampuan perangkat dilaporkan dari browser companion. Tidak ada status izin Android yang dibuat-buat.</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/40"><span className="text-slate-300">Geolocation API</span><span className={child.companionPermissions.location ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>{child.companionPermissions.location ? 'Diizinkan' : 'Belum diizinkan'}</span></div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/40"><span className="text-slate-300">Usage Stats Android</span><span className="text-slate-500">Native only</span></div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/40"><span className="text-slate-300">Device Lock / App Block</span><span className="text-slate-500">Native only</span></div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/40"><span className="text-slate-300">Kamera & Screen Share</span><span className="text-amber-300">Perlu persetujuan anak</span></div>
            </div>
          </div>
          <button onClick={() => onNavigateTab('compliance')} className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-between">
            <span>Kenapa transparansi penting untuk anak?</span><ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* App Usage Quick Controls & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Used Apps with Block Switch */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Penggunaan Aplikasi Hari Ini</h2>
              <p className="text-xs text-slate-400">Data hanya berasal dari companion; kontrol aplikasi native memerlukan Android companion.</p>
            </div>
            <button
              onClick={() => onNavigateTab('screentime')}
              className="text-xs text-emerald-400 hover:underline font-semibold"
            >
              Lihat Semua Aplikasi
            </button>
          </div>

          <div className="space-y-3">
            {child.appUsages.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 hover:border-slate-600 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    {getAppIcon(app.iconName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{app.name}</span>
                      {app.isBlocked && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                          Diblokir
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{app.minutesToday} menit hari ini</span>
                      {app.dailyLimitMinutes > 0 && (
                        <>
                          <span>•</span>
                          <span>Batas: {app.dailyLimitMinutes}m</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    disabled
                    onClick={() => onToggleBlockApp(app.id)}
                    title="Memerlukan companion Android native"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition opacity-60 cursor-not-allowed ${
                      app.isBlocked
                        ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {app.isBlocked ? 'Buka Blokir' : 'Blokir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Activity Log */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Peringatan Keamanan</span>
              </h2>
              <button
                onClick={() => onNavigateTab('alerts')}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Semua ({alerts.length})
              </button>
            </div>

            <div className="space-y-3">
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border text-xs ${
                    alert.severity === 'critical'
                      ? 'bg-red-950/40 border-red-600/50 text-red-200'
                      : alert.severity === 'high'
                      ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      {alert.type === 'sos' && <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />}
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">{alert.timestamp}</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 text-center">
            <span className="text-xs text-slate-400">
              Notifikasi diperbarui otomatis secara realtime
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
