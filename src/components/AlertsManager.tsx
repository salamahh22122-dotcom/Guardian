import React, { useState } from 'react';
import { 
  Bell, AlertTriangle, ShieldCheck, Battery, Clock, CheckCircle2, 
  XCircle, Filter, Trash2, CheckCheck
} from 'lucide-react';
import { AlertNotification, TimeRequest } from '../types';

interface AlertsManagerProps {
  alerts: AlertNotification[];
  timeRequests: TimeRequest[];
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onMarkAllAsRead: () => void;
  onClearAlerts: () => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  timeRequests,
  onApproveRequest,
  onRejectRequest,
  onMarkAllAsRead,
  onClearAlerts,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredAlerts = alerts.filter(
    (a) => filterType === 'all' || a.type === filterType
  );

  const pendingRequests = timeRequests.filter(r => r.status === 'pending');

  const getAlertIcon = (type: AlertNotification['type']) => {
    switch (type) {
      case 'sos': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'geofence': return <ShieldCheck className="w-5 h-5 text-teal-400" />;
      case 'battery': return <Battery className="w-5 h-5 text-amber-400" />;
      case 'screen_time': return <Clock className="w-5 h-5 text-sky-400" />;
      default: return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-400" />
            <span>Notifikasi & Log Aktivitas Keamanan</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Riwayat peringatan yang benar-benar dikirim oleh companion dan permintaan tambahan waktu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tandai Dibaca</span>
          </button>
          <button
            onClick={onClearAlerts}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-red-900/60 hover:text-red-300 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua</span>
          </button>
        </div>
      </div>

      {/* Pending Time Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-slate-800/90 border border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4">
          <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span>Permintaan Tambahan Waktu Menunggu Persetujuan ({pendingRequests.length})</span>
          </h2>

          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <span>{req.childName}</span>
                    <span className="text-xs text-slate-400 font-normal">({req.timestamp})</span>
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      +{req.requestedMinutes} Menit
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 italic">
                    Alasan: &quot;{req.reason}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onApproveRequest(req.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui (+{req.requestedMinutes}m)</span>
                  </button>
                  <button
                    onClick={() => onRejectRequest(req.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-xl transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        <Filter className="w-4 h-4 text-slate-400 mr-1" />
        {[
          { id: 'all', label: 'Semua Notifikasi' },
          { id: 'sos', label: 'Darurat SOS' },
          { id: 'geofence', label: 'Zona Aman (Geofence)' },
          { id: 'screen_time', label: 'Waktu Layar' },
          { id: 'battery', label: 'Baterai' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              filterType === f.id
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">Tidak ada notifikasi pada kategori ini</p>
            <p className="text-xs text-slate-500 mt-1">Belum ada peringatan tersimpan untuk kategori ini.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border transition flex items-start gap-4 ${
                alert.severity === 'critical'
                  ? 'bg-red-950/30 border-red-500/50'
                  : alert.severity === 'high'
                  ? 'bg-amber-950/30 border-amber-500/50'
                  : 'bg-slate-800/80 border-slate-700/80'
              } ${!alert.isRead ? 'ring-1 ring-emerald-500/30' : ''}`}
            >
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex-shrink-0">
                {getAlertIcon(alert.type)}
              </div>

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{alert.title}</h3>
                    {!alert.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{alert.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
