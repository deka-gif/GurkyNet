import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  CheckCircle2,
  Wrench,
  WifiOff,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  X,
  Edit,
  Save,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';

function resolvePartnerStatus(item: any): string {
  const raw = item?.status || item?.partnerStatus || item?.partner_status || 'Online';
  const s = String(raw).toLowerCase();
  if (s === 'online' || s === 'active' || s === 'on') return 'Online';
  if (s === 'maintenance') return 'Maintenance';
  return 'Offline';
}

export const OperationsProviderManagement: React.FC = () => {
  const {
    providers,
    providersPagination,
    providersLoading,
    providersError,
    fetchProviders,
    refreshProviderStatuses,
    updateProvider,
    syncCatalog,
    syncLoading,
  } = useOperationsStore();

  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [editingProvider, setEditingProvider] = useState<any | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [serviceFilter, setServiceFilter] = useState<string>('All');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const loadData = useCallback(
    (page: number = 1) => {
      const params: Record<string, any> = {
        page,
        per_page: 25,
        sort: 'priority',
      };
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();
      if (serviceFilter !== 'All') params.supported_service = serviceFilter;
      if (searchQuery !== '') params.search = searchQuery;
      fetchProviders(params);
    },
    [statusFilter, serviceFilter, searchQuery, fetchProviders]
  );

  useEffect(() => {
    loadData(currentPage);
  }, [loadData, currentPage]);

  const handleToggleStatus = async (item: any, newStatus: string) => {
    const providerId = item.id ?? item.code;
    const result = await updateProvider(providerId, { status: newStatus.toLowerCase() });
    if (result.success) {
      setActionMessage({
        type: 'success',
        text: result.message || `Status provider ${item.name || providerId} → ${newStatus}.`,
      });
      loadData(currentPage);
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

    const providerId = editingProvider.id ?? editingProvider.code;
    const payload = {
      name: editingProvider.name,
      status: String(editingProvider.status || 'online').toLowerCase(),
      notes: editingProvider.notes,
    };

    const result = await updateProvider(providerId, payload);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || 'Data provider berhasil disimpan.' });
      setEditingProvider(null);
      loadData(currentPage);
      if (selectedProvider && (selectedProvider.id === providerId || selectedProvider.code === providerId)) {
        setSelectedProvider({ ...selectedProvider, ...payload, status: resolvePartnerStatus(payload) });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal menyimpan perubahan provider.' });
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    const result = await refreshProviderStatuses();
    setRefreshing(false);
    setActionMessage({
      type: result.success ? 'success' : 'error',
      text: result.message || (result.success ? 'Status partner di-refresh dari backend.' : 'Refresh gagal.'),
    });
    if (result.success) loadData(currentPage);
  };

  const totalCount = providersPagination?.total ?? providers.length;
  const pageCurrent = providersPagination?.currentPage ?? currentPage;
  const pageLast = providersPagination?.lastPage ?? 1;

  const getStatusBadge = (status: string) => {
    const s = resolvePartnerStatus({ status });
    if (s === 'Online') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      );
    }
    if (s === 'Maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <Wrench className="w-3.5 h-3.5 text-amber-600" />
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
      {actionMessage && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-semibold animate-bounce ${
            actionMessage.type === 'success'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
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

      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 backdrop-blur-xs text-[11px] font-bold text-blue-200 border border-blue-400/30">
              <Server className="w-3.5 h-3.5" />
              GurkyNet Provider Network Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Provider Management</h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
              Control Center Digiflazz, VIP Payment, dan Midtrans. Status partner langsung mempengaruhi Product
              Management dan Dashboard User.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                const result = await syncCatalog();
                setActionMessage({
                  type: result.success ? 'success' : 'error',
                  text: result.message || (result.success ? 'Sinkronisasi Digiflazz berhasil.' : 'Sinkronisasi gagal.'),
                });
                if (result.success) loadData(currentPage);
              }}
              disabled={syncLoading || providersLoading}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-2xl font-extrabold text-xs shadow-md hover:bg-emerald-400 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>{syncLoading ? 'Syncing...' : 'Sync Digiflazz'}</span>
            </button>
            <button
              onClick={() => void handleRefreshStatus()}
              disabled={providersLoading || refreshing}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing || providersLoading ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Probing...' : 'Refresh Status'}</span>
            </button>
          </div>
        </div>
      </div>

      {providersError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{providersError}</span>
        </div>
      )}

      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Filter Status & Layanan Provider</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {totalCount.toLocaleString('id-ID')} Partners
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status Partner</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Online">Online</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Supported Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="All">Semua Layanan</option>
              <option value="pulsa">Pulsa</option>
              <option value="data">Paket Data</option>
              <option value="game">Game</option>
              <option value="voucher-digital">Voucher Digital</option>
              <option value="langganan-digital">Langganan Digital</option>
              <option value="pln">Token PLN / PLN</option>
              <option value="pdam">PDAM</option>
              <option value="bpjs-kesehatan">BPJS</option>
              <option value="topup-digital">Top Up Digital</option>
              <option value="tagihan">Tagihan</option>
              <option value="international">International Top Up</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Cari Provider / Kode / Layanan</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Digiflazz, VIP, Midtrans, Game..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Provider Management Table</h2>
            <p className="text-xs text-gray-500">Partner integrasi real dari database & health probe backend</p>
          </div>
          <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
            {providers.length} / {totalCount} Partners
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
                  <th className="py-3 px-4">Supported Services</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Last Sync</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {providers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Tidak ada data provider yang memenuhi filter pencarian.
                    </td>
                  </tr>
                ) : (
                  providers.map((item: any) => {
                    const code = item.code || item.id;
                    const name = item.name || '-';
                    const status = resolvePartnerStatus(item);
                    const responseTime = item.avgResponseTime || item.responseTime || item.response_time || '-';
                    const lastSync = item.lastSync || item.last_sync || item.lastSyncAt || '-';
                    const services = Array.isArray(item.supportedServices)
                      ? item.supportedServices.slice(0, 4).join(', ')
                      : '-';

                    return (
                      <tr
                        key={String(code)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        onClick={() => setSelectedProvider(item)}
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <div>{name}</div>
                          <div className="text-[10px] text-gray-400 font-medium">
                            {item.type === 'payment_gateway' ? 'Payment Gateway' : 'Product Provider'}
                            {item.productCount != null ? ` · ${item.productCount} produk` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{code}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(status)}</td>
                        <td className="py-3.5 px-4 text-gray-600 max-w-[220px] truncate" title={services}>
                          {services || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{responseTime}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{lastSync}</td>
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
                              onClick={() =>
                                setEditingProvider({
                                  ...item,
                                  status: status.toLowerCase(),
                                })
                              }
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 transition"
                              title="Edit Provider"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {status === 'Online' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'offline')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-600 hover:text-white text-red-600 transition"
                                title="Disable / Offline"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item, 'online')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-emerald-600 transition"
                                title="Enable / Online"
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

        {pageLast > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
            <span className="text-gray-500 font-medium">
              Halaman {pageCurrent} dari {pageLast} · {totalCount} Partners
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pageCurrent <= 1 || providersLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageLast, p + 1))}
                disabled={pageCurrent >= pageLast || providersLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedProvider.code || selectedProvider.id}
                  </span>
                  {getStatusBadge(resolvePartnerStatus(selectedProvider))}
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

            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Provider Name</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedProvider.name}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Code</span>
                  <div className="font-mono font-extrabold text-blue-700 mt-0.5">
                    {selectedProvider.code || selectedProvider.id}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Status</span>
                  <div className="mt-0.5">{getStatusBadge(resolvePartnerStatus(selectedProvider))}</div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">API Health</span>
                  <div className="font-extrabold text-indigo-700 mt-0.5">
                    {selectedProvider.apiStatusLabel || selectedProvider.apiStatus || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Response Time</span>
                  <div className="font-mono font-extrabold text-indigo-700 mt-0.5">
                    {selectedProvider.avgResponseTime || selectedProvider.responseTime || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Product Count</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedProvider.productCount ?? 0}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Last Sync</span>
                  <div className="font-mono text-gray-700 mt-0.5">
                    {selectedProvider.lastSync || selectedProvider.last_sync || '-'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Supported Services</span>
                  <div className="font-medium text-gray-800 mt-0.5">
                    {(selectedProvider.supportedServices || []).join(', ') || '-'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Catatan Operasional:</h3>
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedProvider.notes || selectedProvider.description || 'Tidak ada catatan tambahan.'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingProvider({
                    ...selectedProvider,
                    status: resolvePartnerStatus(selectedProvider).toLowerCase(),
                  });
                  setSelectedProvider(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                Edit Provider
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

      {editingProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900 text-base">
                  Edit Provider ({editingProvider.code || editingProvider.id})
                </h3>
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
                  disabled={editingProvider.type === 'payment_gateway'}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Status Partner</label>
                <select
                  value={String(editingProvider.status || 'online').toLowerCase()}
                  onChange={(e) => setEditingProvider({ ...editingProvider, status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="online">Online</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="offline">Offline</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Maintenance: produk tetap terlihat di User Dashboard tetapi tidak bisa dibeli. Offline: produk
                  disembunyikan.
                </p>
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
                  {providersLoading ? 'Menyimpan...' : 'Simpan Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
