import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Activity,
  CheckCircle2,
  Wrench,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Server,
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { operationsService } from '../../services/operations.service';

type NocView = 'grid' | 'service' | 'provider';

function statusTone(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'online') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'maintenance') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function statusDot(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'online') return 'bg-emerald-500';
  if (s === 'partial') return 'bg-amber-500';
  if (s === 'maintenance') return 'bg-orange-500';
  return 'bg-rose-500';
}

export const OperationsServiceMonitoring: React.FC = () => {
  const {
    monitoringData,
    monitoringLoading,
    monitoringError,
    fetchMonitoring,
    refreshMonitoring,
    fetchMonitoringServiceDetail,
    fetchMonitoringServiceIssues,
  } = useOperationsStore();

  const [statusFilter, setStatusFilter] = useState('Semua');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [view, setView] = useState<NocView>('grid');
  const [serviceDetail, setServiceDetail] = useState<any | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesPagination, setIssuesPagination] = useState<any | null>(null);
  const [issuesPage, setIssuesPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [infra, setInfra] = useState<any>(null);

  useEffect(() => {
    void operationsService.getInfraMonitoring().then(setInfra).catch(() => setInfra(null));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const apiStatus = useMemo(() => {
    if (statusFilter === 'Semua') return undefined;
    return statusFilter;
  }, [statusFilter]);

  const loadData = useCallback(() => {
    fetchMonitoring({
      status: apiStatus,
      search: searchQuery !== '' ? searchQuery : undefined,
    });
  }, [apiStatus, searchQuery, fetchMonitoring]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const services = useMemo(() => {
    if (!monitoringData) return [];
    if (Array.isArray(monitoringData.services)) return monitoringData.services;
    return [];
  }, [monitoringData]);

  const summary = monitoringData?.summary || {};
  const checkedAt = monitoringData?.checkedAt || '—';

  const handleRefresh = async () => {
    setActionMessage(null);
    const result = await refreshMonitoring({
      status: apiStatus,
      search: searchQuery !== '' ? searchQuery : undefined,
    });
    setActionMessage({
      type: result.success ? 'success' : 'error',
      text: result.message || (result.success ? 'Refresh berhasil.' : 'Refresh gagal.'),
    });
  };

  const openService = async (serviceKey: string) => {
    setDetailLoading(true);
    setActionMessage(null);
    const detail = await fetchMonitoringServiceDetail(serviceKey);
    setDetailLoading(false);
    if (!detail) {
      setActionMessage({ type: 'error', text: 'Gagal memuat detail service.' });
      return;
    }
    setServiceDetail(detail);
    setSelectedProvider(null);
    setIssues([]);
    setIssuesPagination(null);
    setView('service');
  };

  const openProvider = async (provider: any) => {
    if (!serviceDetail?.key) return;
    setSelectedProvider(provider);
    setDetailLoading(true);
    setIssuesPage(1);
    const payload = await fetchMonitoringServiceIssues(serviceDetail.key, {
      product_provider_id: provider?.id || undefined,
      page: 1,
      per_page: 50,
    });
    setDetailLoading(false);
    setIssues(Array.isArray(payload?.data) ? payload.data : []);
    setIssuesPagination(payload?.pagination || null);
    setView('provider');
  };

  const loadIssuesPage = async (page: number) => {
    if (!serviceDetail?.key || !selectedProvider) return;
    setDetailLoading(true);
    setIssuesPage(page);
    const payload = await fetchMonitoringServiceIssues(serviceDetail.key, {
      product_provider_id: selectedProvider?.id || undefined,
      page,
      per_page: 50,
    });
    setDetailLoading(false);
    setIssues(Array.isArray(payload?.data) ? payload.data : []);
    setIssuesPagination(payload?.pagination || null);
  };

  const backToGrid = () => {
    setView('grid');
    setServiceDetail(null);
    setSelectedProvider(null);
    setIssues([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
            <Activity className="w-3.5 h-3.5" />
            Network Operations Center
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Service Monitoring</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kesehatan layanan PPOB real-time — bukan daftar produk. Last check: {checkedAt}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={monitoringLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${monitoringLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {actionMessage && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            actionMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {infra && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4" /> App-level infra
            </p>
            <button
              type="button"
              className="text-xs font-bold text-sky-700"
              onClick={async () => {
                const refreshed = await operationsService.refreshInfraMonitoring();
                setInfra(refreshed?.infra || refreshed);
              }}
            >
              Refresh probes
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            {['redis', 'database', 'cache', 'queue', 'failed_jobs', 'scheduler'].map((key) => (
              <div key={key} className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="uppercase text-[10px] text-slate-400 font-bold">{key}</p>
                <p className="font-black mt-0.5">{String(infra?.[key]?.status || '—').toUpperCase()}</p>
              </div>
            ))}
            {['cpu', 'ram', 'disk'].map((key) => (
              <div key={key} className="rounded-xl border border-dashed border-slate-200 px-3 py-2 bg-slate-50">
                <p className="uppercase text-[10px] text-slate-400 font-bold">{key}</p>
                <p className="font-black mt-0.5">N/A</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Metric Not Available</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {monitoringError && view === 'grid' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {monitoringError}
        </div>
      )}

      {view === 'grid' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Total', value: summary.total_services ?? services.length, icon: Server },
              { label: 'Online', value: summary.online_services ?? 0, icon: CheckCircle2, tone: 'text-emerald-600' },
              { label: 'Partial', value: summary.partial_services ?? 0, icon: AlertTriangle, tone: 'text-amber-600' },
              { label: 'Maintenance', value: summary.maintenance_services ?? 0, icon: Wrench, tone: 'text-orange-600' },
              { label: 'Offline', value: summary.offline_services ?? 0, icon: WifiOff, tone: 'text-rose-600' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{card.label}</span>
                  <card.icon className={`w-4 h-4 ${card.tone || 'text-slate-400'}`} />
                </div>
                <div className={`mt-2 text-2xl font-semibold ${card.tone || 'text-slate-900'}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama service (Pulsa, Game, PLN…)"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Semua', 'Online', 'Partial', 'Maintenance', 'Offline'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                    statusFilter === status
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {monitoringLoading && services.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              Memuat status layanan…
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              Tidak ada service yang cocok dengan filter.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service: any) => {
                const status = service.status || 'Offline';
                const providers: string[] = service.providerNames || service.providers || [];
                return (
                  <button
                    key={service.key || service.id}
                    type="button"
                    onClick={() => openService(service.key || service.id)}
                    className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-400 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{service.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {providers.length > 0 ? providers.join(' · ') : 'Belum ada provider'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(status)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                        {status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Total SKU</div>
                        <div className="font-semibold text-slate-900">{Number(service.totalSku || 0).toLocaleString('id-ID')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Last Check</div>
                        <div className="font-semibold text-slate-900">{service.lastCheck || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Online / Maint / Offline</div>
                        <div className="font-semibold text-slate-900">
                          {service.onlineSku ?? 0} / {service.maintenanceSku ?? 0} / {service.offlineSku ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Latency · Success</div>
                        <div className="font-semibold text-slate-900">
                          {service.latency || '—'} · {service.successRate != null ? `${service.successRate}%` : '—'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === 'service' && serviceDetail && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={backToGrid}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke NOC
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{serviceDetail.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Level 1 — Provider pada service ini</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(serviceDetail.status)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(serviceDetail.status)}`} />
                {serviceDetail.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Total SKU</div>
                <div className="font-semibold">{Number(serviceDetail.totalSku || 0).toLocaleString('id-ID')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Online</div>
                <div className="font-semibold text-emerald-700">{serviceDetail.onlineSku ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Maintenance</div>
                <div className="font-semibold text-orange-700">{serviceDetail.maintenanceSku ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Offline</div>
                <div className="font-semibold text-rose-700">{serviceDetail.offlineSku ?? 0}</div>
              </div>
            </div>
          </div>

          {detailLoading && !serviceDetail.providers?.length ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              Memuat provider…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(serviceDetail.providers || []).map((provider: any) => (
                <button
                  key={provider.id || provider.code || provider.name}
                  type="button"
                  onClick={() => openProvider(provider)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{provider.name}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(provider.status)}`}>
                      {provider.status}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Total SKU {provider.totalSku ?? 0} · Online {provider.onlineSku ?? 0} · Maint {provider.maintenanceSku ?? 0} · Offline{' '}
                    {provider.offlineSku ?? 0}
                  </div>
                </button>
              ))}
              {(serviceDetail.providers || []).length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 sm:col-span-2">
                  Belum ada produk/provider untuk service ini.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'provider' && serviceDetail && selectedProvider && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setView('service')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke {serviceDetail.name}
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{serviceDetail.name}</div>
                <h2 className="text-xl font-semibold text-slate-900 mt-1">Provider · {selectedProvider.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Level 2 — Ringkasan kesehatan provider</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(selectedProvider.status)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(selectedProvider.status)}`} />
                {selectedProvider.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 text-sm">
              <div>
                <div className="text-xs text-slate-500">Total SKU</div>
                <div className="font-semibold">{Number(selectedProvider.totalSku || 0).toLocaleString('id-ID')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Online</div>
                <div className="font-semibold text-emerald-700">{selectedProvider.onlineSku ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Maintenance</div>
                <div className="font-semibold text-orange-700">{selectedProvider.maintenanceSku ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Offline</div>
                <div className="font-semibold text-rose-700">{selectedProvider.offlineSku ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Latency</div>
                <div className="font-semibold">{selectedProvider.latency || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Success Rate</div>
                <div className="font-semibold">
                  {selectedProvider.successRate != null ? `${selectedProvider.successRate}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Last Sync</div>
                <div className="font-semibold">{selectedProvider.lastSyncAt || '—'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Level 3 — SKU bermasalah saja</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Hanya Maintenance & Offline. SKU Online tidak ditampilkan.
              </p>
            </div>

            {detailLoading ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Memuat SKU bermasalah…</div>
            ) : issues.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                Tidak ada SKU Maintenance/Offline pada provider ini.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {issues.map((sku: any) => (
                  <li key={sku.id || sku.code} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <div className="font-medium text-slate-900">{sku.name}</div>
                      <div className="text-xs text-slate-500">{sku.code}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(sku.status)}`}>
                      {sku.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {issuesPagination && issuesPagination.lastPage > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
                <span className="text-slate-500">
                  Halaman {issuesPagination.currentPage} / {issuesPagination.lastPage} · {issuesPagination.total} SKU
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={issuesPage <= 1 || detailLoading}
                    onClick={() => loadIssuesPage(issuesPage - 1)}
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={issuesPage >= issuesPagination.lastPage || detailLoading}
                    onClick={() => loadIssuesPage(issuesPage + 1)}
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
