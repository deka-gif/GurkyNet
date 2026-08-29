import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tag,
  TrendingUp,
  Search,
  Filter,
  Eye,
  Edit,
  AlertTriangle,
  X,
  CheckCircle2,
  XCircle,
  Wrench,
  RefreshCw,
  Layers,
  ChevronLeft,
  ChevronRight,
  Save,
  ArrowLeft,
  FolderTree,
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { operationsService } from '../../services/operations.service';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

function resolveOpsStatus(item: any): string {
  const raw = item?.opsStatus || item?.ops_status || item?.availabilityStatus || item?.status || 'active';
  const s = String(raw).toLowerCase();
  if (s === 'active' || s === 'tersedia' || s === '1' || s === 'true') return 'active';
  if (s === 'inactive' || s === 'nonaktif' || s === 'gangguan' || s === '0' || s === 'false') return 'inactive';
  if (s === 'maintenance') return 'maintenance';
  return s;
}

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pulsa', label: 'Pulsa' },
  { value: 'data', label: 'Paket Data' },
  { value: 'voucher-internet', label: 'Voucher Internet' },
  { value: 'pln', label: 'PLN' },
  { value: 'topup-digital', label: 'E-Wallet' },
  { value: 'game', label: 'Game' },
  { value: 'voucher-digital', label: 'Voucher Digital' },
  { value: 'langganan-digital', label: 'Langganan Digital' },
  { value: 'tagihan', label: 'Tagihan' },
  { value: 'transfer', label: 'Transfer' },
];

export const OperationsPricingManagement: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Operations.
  const isOwnerReadOnly = useOwnerReadOnly();
  const {
    pricingProducts,
    pricingNodes,
    pricingLevel,
    pricingBreadcrumb,
    pricingPagination,
    pricingSummary,
    pricingLoading,
    pricingError,
    fetchPricing,
    updatePricing,
  } = useOperationsStore();

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [editingPricing, setEditingPricing] = useState<any | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [productProviders, setProductProviders] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drill-down state
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [nodeKey, setNodeKey] = useState<string | null>(null);
  const [dataGroup, setDataGroup] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await operationsService.getProductProviders();
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const paymentCodes = new Set(['midtrans', 'xendit', 'alterra', 'artajasa']);
        const items = raw
          .filter((p: any) => p && p.id != null && p.code && !paymentCodes.has(String(p.code).toLowerCase()))
          .map((p: any) => ({
            id: Number(p.id),
            code: String(p.code),
            name: String(p.name || p.code),
          }));
        if (!cancelled) setProductProviders(items);
      } catch {
        if (!cancelled) setProductProviders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const resetDrillDown = () => {
    setBrandId(null);
    setBrandName(null);
    setNodeKey(null);
    setDataGroup(null);
    setCurrentPage(1);
  };

  const loadData = useCallback(
    (page: number = 1) => {
      const params: Record<string, any> = {
        page,
        per_page: 50,
        sort: 'name_asc',
      };
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (providerFilter !== 'All') params.product_provider_id = Number(providerFilter);
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();
      if (searchQuery !== '') params.search = searchQuery;
      if (brandId) params.brand_id = brandId;
      if (nodeKey) params.node_key = nodeKey;
      if (dataGroup) params.data_group = dataGroup;
      fetchPricing(params);
    },
    [categoryFilter, providerFilter, statusFilter, searchQuery, brandId, nodeKey, dataGroup, fetchPricing]
  );

  useEffect(() => {
    loadData(currentPage);
  }, [loadData, currentPage]);

  const isSkuLevel = pricingLevel === 'skus';

  const openNode = (node: any) => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);

    if (node.type === 'category') {
      setCategoryFilter(node.key);
      resetDrillDown();
      return;
    }
    if (node.type === 'subcategory') {
      setNodeKey(node.key);
      setBrandId(null);
      setBrandName(null);
      setDataGroup(null);
      return;
    }
    if (node.type === 'brand') {
      setBrandId(Number(node.brandId || node.id));
      setBrandName(node.name);
      setDataGroup(null);
      return;
    }
    if (node.type === 'group') {
      setBrandId(Number(node.brandId));
      setBrandName(node.brandName || brandName);
      setDataGroup(node.key);
    }
  };

  const goBack = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
    if (dataGroup) {
      setDataGroup(null);
      return;
    }
    if (brandId) {
      setBrandId(null);
      setBrandName(null);
      return;
    }
    if (nodeKey) {
      setNodeKey(null);
      return;
    }
  };

  const openEdit = (item: any) => {
    const base = Number(item.basePrice ?? item.base_price ?? 0);
    const selling = Number(item.sellingPrice ?? item.selling_price ?? 0);
    const margin = Number(item.margin ?? Math.max(0, selling - base));
    setFormError(null);
    setEditingPricing({
      ...item,
      basePrice: base,
      sellingPrice: selling,
      margin,
      status: resolveOpsStatus(item),
    });
  };

  const handleMarginChange = (value: number) => {
    if (!editingPricing) return;
    const margin = Math.max(0, Number(value) || 0);
    const base = Number(editingPricing.basePrice ?? 0);
    setEditingPricing({ ...editingPricing, margin, sellingPrice: base + margin });
  };

  const handleSellingChange = (value: number) => {
    if (!editingPricing) return;
    const selling = Number(value) || 0;
    const base = Number(editingPricing.basePrice ?? 0);
    setEditingPricing({
      ...editingPricing,
      sellingPrice: selling,
      margin: Math.max(0, selling - base),
    });
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPricing) return;

    const productId = editingPricing.id;
    const base = Number(editingPricing.basePrice ?? 0);
    const selling = Number(editingPricing.sellingPrice ?? 0);
    const margin = Number(editingPricing.margin ?? 0);

    if (base <= 0) {
      setFormError('Base Price kosong. Sinkron ulang produk dari provider.');
      return;
    }
    if (margin < 0) {
      setFormError('Margin tidak boleh negatif.');
      return;
    }
    if (selling < base) {
      setFormError('Selling Price tidak boleh lebih kecil dari Base Price.');
      return;
    }

    const payload = {
      product_id: productId,
      sell_price: selling,
      margin,
      status: String(editingPricing.status || 'active').toLowerCase(),
    };

    const result = await updatePricing(payload, productId);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || 'Skema harga berhasil diperbarui.' });
      setEditingPricing(null);
      setFormError(null);
      loadData(currentPage);
    } else {
      setFormError(result.message || 'Gagal menyimpan skema harga.');
      setActionMessage({ type: 'error', text: result.message || 'Gagal menyimpan skema harga.' });
    }
  };

  const totalProductsCount = pricingSummary?.total_products ?? 0;
  const avgMarginRp = Math.round(Number(pricingSummary?.average_margin ?? 0));
  const activeSkuCount = pricingSummary?.active_sku_count ?? 0;
  const pageCurrent = pricingPagination?.currentPage ?? currentPage;
  const pageLast = pricingPagination?.lastPage ?? 1;
  const canGoBack = !!(brandId || nodeKey || dataGroup);

  const getStatusBadge = (status: string) => {
    const s = resolveOpsStatus({ status });
    if (s === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Active
        </span>
      );
    }
    if (s === 'inactive') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
          <XCircle className="w-3.5 h-3.5" /> Inactive
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        <Wrench className="w-3.5 h-3.5" /> Maintenance
      </span>
    );
  };

  const levelTitle = () => {
    if (isSkuLevel) return brandName ? `SKU · ${brandName}${dataGroup ? ` · ${dataGroup}` : ''}` : 'SKU';
    if (pricingLevel === 'groups') return `Group · ${brandName || 'Operator'}`;
    if (pricingLevel === 'subcategories') return categoryFilter === 'pln' ? 'Jenis PLN' : 'Vendor Tagihan';
    if (pricingLevel === 'categories') return 'Kategori';
    if (categoryFilter === 'game') return 'Brand Game';
    if (categoryFilter === 'pulsa' || categoryFilter === 'data') return 'Operator';
    if (categoryFilter === 'topup-digital' || categoryFilter === 'voucher-digital' || categoryFilter === 'langganan-digital') {
      return 'Brand';
    }
    return 'Brand / Operator';
  };

  return (
    <div className="space-y-6 pb-12">
      {actionMessage && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-semibold ${
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
          <button type="button" onClick={() => setActionMessage(null)} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
              <FolderTree className="w-3.5 h-3.5" />
              Hierarchical Pricing Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Pricing & Margin Management</h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
              Category → Brand/Operator → Group → SKU. Scalable untuk puluhan ribu produk tanpa flat dump.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(currentPage)}
            disabled={pricingLoading}
            className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-600 ${pricingLoading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
        </div>
      </div>

      {pricingError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{pricingError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Total Products</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{Number(totalProductsCount).toLocaleString('id-ID')} SKU</div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Average Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">Rp {avgMarginRp.toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Active SKU Count</span>
            <Tag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{Number(activeSkuCount).toLocaleString('id-ID')} Active</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {(pricingPagination?.total ?? 0).toLocaleString('id-ID')} items · level {pricingLevel || '-'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                resetDrillDown();
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Provider</option>
              {productProviders.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  isSkuLevel
                    ? 'Cari SKU / nominal…'
                    : 'Cari brand, operator, produk…'
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Kembali
                </button>
              )}
              <h2 className="text-base font-extrabold text-gray-900">{levelTitle()}</h2>
            </div>
            {pricingBreadcrumb.length > 0 && (
              <p className="text-xs text-gray-500">
                {pricingBreadcrumb.map((c: any) => c.label).join(' → ')}
              </p>
            )}
          </div>
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-mono">
            {(pricingPagination?.total ?? 0).toLocaleString('id-ID')}{' '}
            {isSkuLevel ? 'SKU' : 'item'}
          </span>
        </div>

        {pricingLoading && pricingNodes.length === 0 && pricingProducts.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat katalog harga…</p>
          </div>
        ) : isSkuLevel ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Product Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Base Price</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      Tidak ada SKU pada level ini.
                    </td>
                  </tr>
                ) : (
                  pricingProducts.map((item: any) => {
                    const code = item.code || item.sku_code || item.id;
                    const basePrice = Number(item.basePrice ?? item.base_price ?? 0);
                    const sellingPrice = Number(item.sellingPrice ?? item.selling_price ?? 0);
                    const marginRp = Number(item.margin ?? sellingPrice - basePrice);
                    return (
                      <tr key={item.id || code} className="hover:bg-emerald-50/40">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{code}</td>
                        <td className="py-3.5 px-4 font-extrabold text-gray-900 max-w-xs truncate">{item.name}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-700">
                          {item.productProvider || item.provider || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono">Rp {basePrice.toLocaleString('id-ID')}</td>
                        <td className="py-3.5 px-4 font-mono font-extrabold">
                          Rp {sellingPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-emerald-700">
                          +Rp {marginRp.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(resolveOpsStatus(item))}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-600"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!isOwnerReadOnly && (
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600"
                              >
                                <Edit className="w-3.5 h-3.5" />
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">
                    {pricingLevel === 'groups'
                      ? 'Group'
                      : pricingLevel === 'subcategories' || pricingLevel === 'categories'
                        ? 'Name'
                        : 'Brand'}
                  </th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Jumlah SKU</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingNodes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      Tidak ada brand/operator yang cocok. Pilih Category atau ubah filter.
                    </td>
                  </tr>
                ) : (
                  pricingNodes.map((node: any) => (
                    <tr
                      key={node.key || node.id || node.name}
                      className="hover:bg-emerald-50/40 cursor-pointer"
                      onClick={() => openNode(node)}
                    >
                      <td className="py-3.5 px-4 font-extrabold text-gray-900">{node.name}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-700">
                        {node.providerLabel ||
                          (Array.isArray(node.providers) ? node.providers.join(' + ') : '-') ||
                          '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-emerald-700">
                        {Number(node.skuCount || 0).toLocaleString('id-ID')} SKU
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNode(node);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-[11px]"
                        >
                          Buka
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {pageLast > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
            <span className="text-gray-500 font-medium">
              Halaman {pageCurrent} dari {pageLast}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pageCurrent <= 1 || pricingLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pageLast, p + 1))}
                disabled={pageCurrent >= pageLast || pricingLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 font-bold disabled:opacity-50 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l">
            <div className="p-6 bg-slate-900 text-white flex justify-between">
              <div>
                <div className="text-xs font-mono text-emerald-400">
                  {selectedProduct.code || selectedProduct.sku_code}
                </div>
                <h2 className="text-lg font-extrabold">{selectedProduct.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 rounded-xl bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 text-xs space-y-3 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-400 font-bold uppercase text-[10px]">Base</div>
                  <div className="font-mono font-bold">
                    Rp {Number(selectedProduct.basePrice ?? selectedProduct.base_price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-bold uppercase text-[10px]">Selling</div>
                  <div className="font-mono font-bold">
                    Rp {Number(selectedProduct.sellingPrice ?? selectedProduct.selling_price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              {getStatusBadge(resolveOpsStatus(selectedProduct))}
            </div>
            <div className="p-4 border-t flex gap-2">
              {!isOwnerReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    openEdit(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4" /> Edit Harga
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPricing && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base">Edit Pricing</h3>
              <button type="button" onClick={() => setEditingPricing(null)} className="p-1.5 rounded-lg bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePricing} className="space-y-3 text-xs">
              {[
                ['Product Code', editingPricing.code || editingPricing.sku_code],
                ['Nama Produk', editingPricing.name],
                ['Provider', editingPricing.productProvider || editingPricing.provider],
                ['Operator', editingPricing.operator || editingPricing.operatorName],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <label className="block font-bold text-gray-500 mb-1">{label}</label>
                  <input value={String(value || '-')} readOnly className="w-full bg-gray-100 border rounded-xl p-2.5" />
                </div>
              ))}
              <div>
                <label className="block font-bold text-gray-500 mb-1">Base Price (read only)</label>
                <input type="number" value={editingPricing.basePrice ?? 0} readOnly className="w-full bg-gray-100 border rounded-xl p-2.5 font-mono" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Margin</label>
                <input
                  type="number"
                  min={0}
                  value={editingPricing.margin ?? 0}
                  onChange={(e) => handleMarginChange(Number(e.target.value))}
                  className="w-full bg-gray-50 border rounded-xl p-2.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Selling Price</label>
                <input
                  type="number"
                  min={0}
                  value={editingPricing.sellingPrice ?? 0}
                  onChange={(e) => handleSellingChange(Number(e.target.value))}
                  className="w-full bg-gray-50 border rounded-xl p-2.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Status</label>
                <select
                  value={editingPricing.status || 'active'}
                  onChange={(e) => setEditingPricing({ ...editingPricing, status: e.target.value })}
                  className="w-full bg-gray-50 border rounded-xl p-2.5"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 font-semibold">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingPricing(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 font-bold">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pricingLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {pricingLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
