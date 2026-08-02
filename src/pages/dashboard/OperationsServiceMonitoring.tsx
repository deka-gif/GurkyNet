import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  Wrench,
  WifiOff,
  AlertOctagon,
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
  X,
  Wifi,
  Tv,
  Smartphone,
  Zap,
  CreditCard,
  Gamepad2,
  Droplet,
  Globe,
  Calendar,
  ShieldAlert,
  Info
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';

export const OperationsServiceMonitoring: React.FC = () => {
  const {
    monitoringData,
    monitoringLoading,
    monitoringError,
    fetchMonitoring
  } = useOperationsStore();

  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);

  const loadData = useCallback(() => {
    fetchMonitoring({
      status: statusFilter !== 'All' ? statusFilter : undefined,
      search: searchQuery.trim() !== '' ? searchQuery.trim() : undefined
    });
  }, [statusFilter, searchQuery, fetchMonitoring]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract real backend data arrays safely
  const servicesList = useMemo(() => {
    if (!monitoringData) return [];
    if (Array.isArray(monitoringData)) return monitoringData;
    if (Array.isArray(monitoringData.services)) return monitoringData.services;
    if (Array.isArray(monitoringData.data)) return monitoringData.data;
    return [];
  }, [monitoringData]);

  const maintenanceList = useMemo(() => {
    if (!monitoringData) return [];
    if (Array.isArray(monitoringData.schedules)) return monitoringData.schedules;
    if (Array.isArray(monitoringData.maintenance)) return monitoringData.maintenance;
    return [];
  }, [monitoringData]);

  const incidentList = useMemo(() => {
    if (!monitoringData) return [];
    if (Array.isArray(monitoringData.incidents)) return monitoringData.incidents;
    if (Array.isArray(monitoringData.logs)) return monitoringData.logs;
    return [];
  }, [monitoringData]);

  // Filtered Services Grid
  const filteredServices = useMemo(() => {
    return servicesList.filter((item: any) => {
      const status = item.status || 'Online';
      if (statusFilter !== 'All' && String(status).toLowerCase() !== statusFilter.toLowerCase()) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const provider = String(item.provider || '').toLowerCase();
        const category = String(item.category || '').toLowerCase();
        if (!name.includes(query) && !provider.includes(query) && !category.includes(query)) return false;
      }

      return true;
    });
  }, [servicesList, statusFilter, searchQuery]);

  // Top Summary Computations
  const onlineCount = useMemo(() => servicesList.filter((s: any) => String(s.status).toLowerCase() === 'online').length, [servicesList]);
  const maintenanceCount = useMemo(() => servicesList.filter((s: any) => String(s.status).toLowerCase() === 'maintenance').length, [servicesList]);
  const offlineCount = useMemo(() => servicesList.filter((s: any) => String(s.status).toLowerCase() === 'offline').length, [servicesList]);

  const getServiceIcon = (type: string) => {
    const t = String(type).toLowerCase();
    if (t.includes('pulsa') || t.includes('phone')) return <Smartphone className="w-5 h-5 text-indigo-600" />;
    if (t.includes('data') || t.includes('wifi')) return <Wifi className="w-5 h-5 text-blue-600" />;
    if (t.includes('pln') || t.includes('electricity')) return <Zap className="w-5 h-5 text-amber-500" />;
    if (t.includes('wallet') || t.includes('card')) return <CreditCard className="w-5 h-5 text-emerald-600" />;
    if (t.includes('game')) return <Gamepad2 className="w-5 h-5 text-purple-600" />;
    if (t.includes('pdam') || t.includes('water')) return <Droplet className="w-5 h-5 text-cyan-600" />;
    if (t.includes('tv') || t.includes('cable')) return <Tv className="w-5 h-5 text-rose-600" />;
    return <Globe className="w-5 h-5 text-slate-600" />;
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'online' || s === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      );
    }
    if (s === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <Wrench className="w-3.5 h-3.5 text-amber-600" />
          Maintenance
        </span>
      );
    }
    if (s === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
          <AlertOctagon className="w-3.5 h-3.5 text-purple-600" />
          Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
        <WifiOff className="w-3.5 h-3.5 text-red-600" />
        Offline
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-xs text-[11px] font-bold text-indigo-200 border border-indigo-400/30">
              <Activity className="w-3.5 h-3.5" />
              GurkyNet Service Monitoring Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Service Monitoring & Maintenance
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
              Pusat pemantauan kesehatan operasional seluruh layanan PPOB, jadwal pemeliharaan jaringan biller, dan kronologi insiden teknis.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData()}
              disabled={monitoringLoading}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${monitoringLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>

            <button
              onClick={() => setHistoryModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-extrabold text-xs shadow-md transition flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Maintenance History</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {monitoringError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{monitoringError}</span>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Online Services</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{onlineCount} / {servicesList.length}</div>
          <div className="text-[11px] text-gray-400">Layanan PPOB berjalan normal</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Services Under Maint.</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{maintenanceCount} Layanan</div>
          <div className="text-[11px] text-gray-400">Pemeliharaan berkala provider</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Offline Services</span>
            <WifiOff className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600">{offlineCount} Layanan</div>
          <div className="text-[11px] text-gray-400">Terputus / Lalu lintas dialihkan</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Active Schedules</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">{maintenanceList.length} Items</div>
          <div className="text-[11px] text-purple-600 font-semibold">Jadwal pemeliharaan terdaftar</div>
        </div>
      </div>

      {/* SERVICE STATUS GRID SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Service Status Grid
            </h2>
            <p className="text-xs text-gray-500">
              Status ketersediaan & respon waktu seluruh kategori utama layanan PPOB
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none"
            >
              <option value="All">Semua Status</option>
              <option value="Online">Online</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Degraded">Degraded</option>
              <option value="Offline">Offline</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari layanan..."
                className="bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none w-40 sm:w-48"
              />
            </div>
          </div>
        </div>

        {monitoringLoading ? (
          <div className="py-12 text-center text-gray-400 space-y-2 bg-white rounded-3xl border border-gray-100">
            <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat metrik pemantauan layanan...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredServices.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">
                Tidak ada data layanan yang memenuhi kriteria pencarian.
              </div>
            ) : (
              filteredServices.map((svc: any) => {
                const id = svc.id || svc.code;
                const name = svc.name || svc.title || '-';
                const category = svc.category || '-';
                const provider = svc.provider || svc.provider_name || '-';
                const responseTime = svc.responseTime || svc.response_time || '-';
                const uptime = svc.uptime || '-';
                const lastUpdated = svc.lastUpdated || svc.last_updated || svc.updated_at || '-';
                const description = svc.description || '-';
                const status = svc.status || 'Online';

                return (
                  <div
                    key={id}
                    className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-gray-50 rounded-2xl border border-gray-100 shrink-0">
                            {getServiceIcon(svc.iconType || category || name)}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-gray-900 text-sm">{name}</h3>
                            <span className="text-[10px] text-gray-400 font-medium">{category}</span>
                          </div>
                        </div>
                        {getStatusBadge(status)}
                      </div>

                      <div className="space-y-1 text-xs font-medium text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Provider:</span>
                          <span className="font-extrabold text-gray-900">{provider}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Response Time:</span>
                          <span className="font-mono font-extrabold text-blue-700">{responseTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Service Uptime:</span>
                          <span className="font-mono font-extrabold text-emerald-700">{uptime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Last Updated:</span>
                          <span className="font-mono text-[10px] text-gray-500">{lastUpdated}</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-600 leading-relaxed truncate">
                        {description}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className="flex-1 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-extrabold border border-indigo-100 transition flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-700" />
                        <span>View Detail</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MAINTENANCE SCHEDULE TABLE */}
      {maintenanceList.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                Maintenance Schedule
              </h2>
              <p className="text-xs text-gray-500">Jadwal pemeliharaan sistem terencana dan penanganan insiden darurat</p>
            </div>
            <span className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-mono">
              {maintenanceList.length} Schedules Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Maintenance ID</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Start Time</th>
                  <th className="py-3 px-4">End Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {maintenanceList.map((mnt: any, idx: number) => (
                  <tr key={mnt.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-800">
                      {mnt.id || `MNT-${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded bg-gray-100 font-bold text-[11px] text-gray-800">
                        {mnt.service || mnt.service_name || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-700">
                      {mnt.provider || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                      {mnt.startTime || mnt.start_time || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                      {mnt.endTime || mnt.end_time || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        {mnt.status || 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-800 max-w-sm truncate">
                      {mnt.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INCIDENT LOG TIMELINE */}
      {incidentList.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                Incident Log Timeline
              </h2>
              <p className="text-xs text-gray-500">Jurnal kronologis insiden teknis & pemulihan otomatis layanan</p>
            </div>
            <span className="text-xs text-red-800 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 font-mono">
              {incidentList.length} Incidents
            </span>
          </div>

          <div className="p-6">
            <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6">
              {incidentList.map((inc: any, idx: number) => (
                <div key={inc.id || idx} className="relative pl-6 group">
                  <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 hover:border-indigo-200 transition">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-400">{inc.time || inc.timestamp || '-'}</span>
                        <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-extrabold text-[10px]">
                          {inc.service || '-'}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                        Status: {inc.currentStatus || inc.status || 'Investigating'}
                      </span>
                    </div>

                    <p className="text-xs font-extrabold text-gray-900">{inc.incident || inc.message || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SERVICE DETAIL DRAWER */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedService.id || selectedService.code}
                  </span>
                  {getStatusBadge(selectedService.status || 'Online')}
                </div>
                <h2 className="text-lg font-extrabold">{selectedService.name || selectedService.title}</h2>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Service Name</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedService.name || selectedService.title}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Category</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedService.category || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Active Provider</span>
                  <div className="font-extrabold text-indigo-700 mt-0.5">{selectedService.provider || selectedService.provider_name || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Current Status</span>
                  <div className="mt-0.5">{getStatusBadge(selectedService.status || 'Online')}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Avg Response Time</span>
                  <div className="font-mono font-extrabold text-blue-700 mt-0.5">{selectedService.responseTime || selectedService.response_time || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Service Uptime</span>
                  <div className="font-mono font-extrabold text-emerald-700 mt-0.5">{selectedService.uptime || '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Deskripsi Layanan:</h3>
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedService.description || 'Tidak ada deskripsi tambahan.'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setSelectedService(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE HISTORY MODAL */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900 text-base">Historical Maintenance Records</h3>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 bg-gray-50 rounded-2xl border border-gray-100 max-h-72 overflow-y-auto text-xs p-2">
              {maintenanceList.length === 0 ? (
                <div className="p-4 text-center text-gray-400">Belum ada riwayat pemeliharaan.</div>
              ) : (
                maintenanceList.map((mnt: any, idx: number) => (
                  <div key={mnt.id || idx} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{mnt.service || mnt.service_name} ({mnt.provider})</span>
                      <span className="font-mono text-[10px] text-gray-400">{mnt.id || `MNT-${idx+1}`}</span>
                    </div>
                    <p className="text-gray-600 text-[11px]">{mnt.description || '-'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Tutup History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
