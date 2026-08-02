import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Wrench,
  WifiOff,
  AlertOctagon,
  RefreshCw,
  Search,
  Filter,
  Eye,
  History,
  AlertTriangle,
  X,
  Edit,
  Save,
  Power,
  PowerOff
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';

export const OperationsProviderManagement: React.FC = () => {
  const {
    providers,
    providersPagination,
    providersLoading,
    providersError,
    fetchProviders,
    updateProvider
  } = useOperationsStore();

  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [editingProvider, setEditingProvider] = useState<any | null>(null);
  const [historyModalProvider, setHistoryModalProvider] = useState<any | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [serviceFilter, setServiceFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast Action Message
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(() => {
    const params: Record<string, any> = {};
    if (statusFilter !== 'All') params.status = statusFilter;
    if (serviceFilter !== 'All') params.service = serviceFilter;
    if (searchQuery.trim() !== '') params.search = searchQuery.trim();

    fetchProviders(params);
  }, [statusFilter, serviceFilter, searchQuery, fetchProviders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async (item: any, newStatus: string) => {
    const providerId = item.id || item.code;
    const result = await updateProvider(providerId, { status: newStatus });
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || `Status provider ${item.name || providerId} berhasil diperbarui.` });
      loadData();
      if (selectedProvider && (selectedProvider.id === providerId || selectedProvider.code === providerId)) {
        setSelectedProvider({ ...selectedProvider, status: newStatus });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal mengubah status provider.' });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;

    const providerId = editingProvider.id || editingProvider.code;
    const payload = {
      name: editingProvider.name,
      status: editingProvider.status,
      notes: editingProvider.notes,
    };

    const result = await updateProvider(providerId, payload);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || 'Data provider berhasil disimpan.' });
      setEditingProvider(null);
      loadData();
      if (selectedProvider && (selectedProvider.id === providerId || selectedProvider.code === providerId)) {
        setSelectedProvider({ ...selectedProvider, ...payload });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal menyimpan perubahan provider.' });
    }
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
    if (s === 'degraded' || s === 'warn') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
          Degraded
        </span>
      );
    }
    if (s === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          <Wrench className="w-3.5 h-3.5 text-blue-600" />
          Maintenance
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
      {/* Toast Notification */}
      {actionMessage && (
        <div className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-semibold animate-bounce ${
          actionMessage.type === 'success' ? 'bg-slate-900 text-white border-slate-700' : 'bg-red-900 text-white border-red-700'
        }`}>
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-[11px] font-bold text-blue-200 border border-blue-400/30">
              <Server className="w-3.5 h-3.5" />
              GurkyNet Provider Network Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Provider Management
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
              Pemantauan terpusat ketersediaan jaringan provider biller aggregator, payment gateway, latensi respon API, dan histori kesehatan integrasi.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData()}
              disabled={providersLoading}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${providersLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {providersError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{providersError}</span>
        </div>
      )}

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Filter Status & Layanan Provider</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {providers.length} Partners Loaded
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status Partner</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Online">Online</option>
              <option value="Degraded">Degraded</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Layanan Didukung (Supported Service)</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Layanan</option>
              <option value="Pulsa">Pulsa</option>
              <option value="Data">Data Package</option>
              <option value="PLN">PLN</option>
              <option value="Game">Game Voucher</option>
              <option value="E-Wallet">E-Wallet</option>
              <option value="PDAM">PDAM</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Cari Provider / Kode</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Digiflazz, Midtrans, PRV-..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PROVIDER TABLE SECTION */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Provider Management Table</h2>
            <p className="text-xs text-gray-500">Daftar integrasi biller switcher & gateway dari backend server</p>
          </div>
          <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
            {providers.length} Partners
          </span>
        </div>

        {providersLoading ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat data provider...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Last Sync</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {providers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Tidak ada data provider yang memenuhi filter pencarian.
                    </td>
                  </tr>
                ) : (
                  providers.map((item: any) => {
                    const code = item.code || item.id;
                    const name = item.name || '-';
                    const status = item.status || 'Online';
                    const responseTime = item.avgResponseTime || item.response_time || item.responseTime || '-';
                    const lastSync = item.lastSync || item.last_sync || item.updated_at || '-';

                    return (
                      <tr
                        key={code}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                        onClick={() => setSelectedProvider(item)}
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {name}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                          {code}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(status)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                          {responseTime}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                          {lastSync}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProvider(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingProvider(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 transition"
                              title="Edit Provider"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {String(status).toLowerCase() === 'online' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'Offline')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-600 hover:text-white text-red-600 transition"
                                title="Disable Provider"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'Online')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-emerald-600 transition"
                                title="Enable Provider"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedProvider.code || selectedProvider.id}
                  </span>
                  {getStatusBadge(selectedProvider.status || 'Online')}
                </div>
                <h2 className="text-lg font-extrabold">{selectedProvider.name}</h2>
              </div>
              <button
                onClick={() => setSelectedProvider(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Provider Name</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedProvider.name}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Provider Code</span>
                  <div className="font-mono font-extrabold text-blue-700 mt-0.5">{selectedProvider.code || selectedProvider.id}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Status</span>
                  <div className="mt-0.5">{getStatusBadge(selectedProvider.status || 'Online')}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Response Time</span>
                  <div className="font-mono font-extrabold text-indigo-700 mt-0.5">
                    {selectedProvider.avgResponseTime || selectedProvider.response_time || '-'}
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Last Sync</span>
                  <div className="font-mono text-gray-700 mt-0.5">{selectedProvider.lastSync || selectedProvider.last_sync || '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Catatan Operasional:</h3>
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedProvider.notes || selectedProvider.description || 'Tidak ada catatan tambahan.'}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingProvider(selectedProvider);
                  setSelectedProvider(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Provider</span>
              </button>
              <button
                onClick={() => setSelectedProvider(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900 text-base">Edit Provider ({editingProvider.code || editingProvider.id})</h3>
              </div>
              <button
                onClick={() => setEditingProvider(null)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nama Provider</label>
                <input
                  type="text"
                  value={editingProvider.name || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Status Partner</label>
                <select
                  value={editingProvider.status || 'Online'}
                  onChange={(e) => setEditingProvider({ ...editingProvider, status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Online">Online</option>
                  <option value="Degraded">Degraded</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Catatan</label>
                <textarea
                  value={editingProvider.notes || editingProvider.description || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProvider(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={providersLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{providersLoading ? 'Menyimpan...' : 'Simpan Provider'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
