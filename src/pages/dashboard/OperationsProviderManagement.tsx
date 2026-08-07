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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { Link } from 'react-router-dom';

function resolvePartnerStatus(item: any): string {
  const raw = item?.status || item?.partnerStatus || item?.partner_status || 'Online';
  const s = String(raw).toLowerCase();
  if (s === 'online' || s === 'active' || s === 'on') return 'Online';
  if (s === 'partial' || s === 'degraded' || s === 'syncing' || s === 'gangguan sebagian') {
    return 'Gangguan Sebagian';
  }
  if (s === 'maintenance') return 'Maintenance';
  if (s === 'auth_failed' || s === 'autentikasi gagal') return 'Autentikasi Gagal';
  if (s === 'not_configured' || s === 'belum dikonfigurasi') return 'Belum Dikonfigurasi';
  if (s === 'disabled') return 'Disabled';
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
  } = useOperationsStore();

  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
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

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    const result = await refreshProviderStatuses();
    setRefreshing(false);
    setActionMessage({
      type: result.success ? 'success' : 'error',
      text: result.message || (result.success ? 'Status provider diperbarui dari health check backend.' : 'Refresh gagal.'),
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
    if (s === 'Gangguan Sebagian') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Gangguan Sebagian
        </span>
      );
    }
    if (s === 'Maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200">
          <Wrench className="w-3.5 h-3.5 text-orange-600" />
          Maintenance
        </span>
      );
    }
    if (s === 'Autentikasi Gagal' || s === 'Belum Dikonfigurasi') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          {s}
        </span>
      );
    }
    if (s === 'Disabled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
          <WifiOff className="w-3.5 h-3.5 text-slate-500" />
          Disabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
        <WifiOff className="w-3.5 h-3.5 text-red-600" />
        Offline
      </span>
    );
  };;

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
              Monitoring Product Provider
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Provider Management</h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
              Dashboard monitoring kondisi Digiflazz, VIP Payment, dan provider PPOB lain. Konfigurasi ON/OFF,
              Priority, Sync, dan Health Check hanya di{' '}
              <Link to="/dashboard/operations/product-providers" className="underline font-bold text-white">
                Product Provider Control Center
              </Link>
              .
            </p>
          </div>

          <button
            onClick={() => void handleRefreshStatus()}
            disabled={providersLoading || refreshing}
            className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing || providersLoading ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memeriksa...' : 'Refresh Status'}</span>
          </button>
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
            {totalCount.toLocaleString('id-ID')} Provider
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
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
              <option value="Gangguan Sebagian">Gangguan Sebagian</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Autentikasi Gagal">Autentikasi Gagal</option>
              <option value="Disabled">Disabled</option>
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
              <option value="tagihan">Tagihan</option>
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
                placeholder="Digiflazz, VIP, Pulsa, Game..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Monitoring Provider PPOB</h2>
            <p className="text-xs text-gray-500">Data real dari database & health check backend — hanya baca</p>
          </div>
          <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
            {providers.length} / {totalCount}
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
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">Supported Services</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Response Time</th>
                  <th className="py-3 px-4">Last Sync</th>
                  <th className="py-3 px-4 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {providers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      Tidak ada data provider yang memenuhi filter pencarian.
                    </td>
                  </tr>
                ) : (
                  providers.map((item: any) => {
                    const code = item.code || item.id;
                    const name = item.name || '-';
                    const status = resolvePartnerStatus(item);
                    const responseTime = item.avgResponseTime || item.responseTime || '-';
                    const lastSync =
                      item.lastSyncDisplay || item.lastSync || item.last_sync || item.lastSyncAt || '-';
                    const services = Array.isArray(item.supportedServices)
                      ? item.supportedServices.slice(0, 4).join(', ')
                      : '-';

                    return (
                      <tr
                        key={String(code)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        onClick={() => setSelectedProvider(item)}
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900">{name}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{code}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(status)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          {item.healthLabel || item.apiStatusLabel || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 max-w-[200px] truncate" title={services}>
                          {services || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          {item.productCountLabel || `${item.productCount ?? 0} SKU`}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{responseTime}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{lastSync}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProvider(item);
                            }}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                            title="Lihat Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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
              Halaman {pageCurrent} dari {pageLast} · {totalCount} Provider
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
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Provider</span>
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
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Health</span>
                  <div className="font-extrabold text-indigo-700 mt-0.5">
                    {selectedProvider.healthLabel || selectedProvider.apiStatusLabel || '-'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Keterangan</span>
                  <div className="font-medium text-gray-800 mt-0.5 leading-relaxed">
                    {selectedProvider.statusDescription ||
                      selectedProvider.description ||
                      selectedProvider.notes ||
                      '-'}
                  </div>
                </div>
                {selectedProvider.healthIndicators && (
                  <div className="col-span-2 grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-gray-200">
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-gray-400 font-bold">Connection</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedProvider.healthIndicators.connection || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-gray-400 font-bold">Authentication</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedProvider.healthIndicators.authentication || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-gray-400 font-bold">Balance</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedProvider.healthIndicators.balance || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wide text-gray-400 font-bold">Service</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedProvider.healthIndicators.service || '—'}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Response Time</span>
                  <div className="font-mono font-extrabold text-indigo-700 mt-0.5">
                    {selectedProvider.avgResponseTime || selectedProvider.responseTime || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">SKU</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">
                    {selectedProvider.productCountLabel || `${selectedProvider.productCount ?? 0} SKU`}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Terakhir Sinkron</span>
                  <div className="font-mono text-gray-700 mt-0.5">
                    {selectedProvider.lastSyncDisplay ||
                      selectedProvider.lastSync ||
                      selectedProvider.last_sync ||
                      '-'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Supported Services</span>
                  <div className="font-medium text-gray-800 mt-0.5">
                    {(selectedProvider.supportedServices || []).join(', ') || '-'}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Halaman ini hanya monitoring. Untuk ON/OFF, Priority, Sync Product, atau Health Check, buka{' '}
                <Link to="/dashboard/operations/product-providers" className="text-indigo-600 font-bold underline">
                  Product Provider Control Center
                </Link>
                .
              </p>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedProvider(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
