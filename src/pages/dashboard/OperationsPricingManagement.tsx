import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Eye,
  Edit,
  History,
  Calculator,
  AlertTriangle,
  X,
  CheckCircle2,
  XCircle,
  Wrench,
  EyeOff,
  RefreshCw,
  Layers,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { operationsService } from '../../services/operations.service';

export const OperationsPricingManagement: React.FC = () => {
  const {
    pricingProducts,
    pricingPagination,
    pricingLoading,
    pricingError,
    fetchPricing,
    updatePricing
  } = useOperationsStore();

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [editingPricing, setEditingPricing] = useState<any | null>(null);
  const [historyModalProduct, setHistoryModalProduct] = useState<any | null>(null);

  // Filters — Product Providers from API only (never payment gateways)
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [providerFilter, setProviderFilter] = useState<string>('All');
  const [productProviders, setProductProviders] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Toast / Status Message
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Price Simulator State
  const [simNewPrice, setSimNewPrice] = useState<number>(0);
  const [simResult, setSimResult] = useState<{
    basePrice: number;
    currentSelling: number;
    newSelling: number;
    estMarginRp: number;
    estMarginPct: number;
  } | null>(null);

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

  const loadData = useCallback((page: number = 1) => {
    const params: Record<string, any> = { page };
    if (categoryFilter !== 'All') params.category = categoryFilter;
    if (providerFilter !== 'All') params.product_provider_id = Number(providerFilter);
    if (statusFilter !== 'All') params.status = statusFilter;
    if (searchQuery.trim() !== '') params.search = searchQuery.trim();

    fetchPricing(params);
  }, [categoryFilter, providerFilter, statusFilter, searchQuery, fetchPricing]);

  useEffect(() => {
    loadData(currentPage);
  }, [loadData, currentPage]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPricing) return;

    const productId = editingPricing.id || editingPricing.code;
    const payload = {
      product_id: productId,
      base_price: Number(editingPricing.basePrice ?? editingPricing.base_price ?? 0),
      selling_price: Number(editingPricing.sellingPrice ?? editingPricing.selling_price ?? 0),
      status: editingPricing.status,
      notes: editingPricing.notes,
    };

    const result = await updatePricing(payload);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || 'Skema harga berhasil diperbarui.' });
      setEditingPricing(null);
      loadData(currentPage);
      if (selectedProduct && (selectedProduct.id === productId || selectedProduct.code === productId)) {
        setSelectedProduct({ ...selectedProduct, ...payload });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal menyimpan skema harga.' });
    }
  };

  // Top Summary Computations
  const totalProductsCount = pricingPagination?.total ?? pricingProducts.length;

  const avgMarginRp = useMemo(() => {
    if (pricingProducts.length === 0) return 0;
    const totalMargin = pricingProducts.reduce((acc, curr) => {
      const base = Number(curr.basePrice ?? curr.base_price ?? 0);
      const selling = Number(curr.sellingPrice ?? curr.selling_price ?? 0);
      return acc + (selling - base);
    }, 0);
    return Math.round(totalMargin / pricingProducts.length);
  }, [pricingProducts]);

  const activeSimulatorProduct = useMemo(() => {
    return pricingProducts[0] || null;
  }, [pricingProducts]);

  const handleCalculateSimulation = () => {
    if (!activeSimulatorProduct) return;
    const base = Number(activeSimulatorProduct.basePrice ?? activeSimulatorProduct.base_price ?? 0);
    const currentSelling = Number(activeSimulatorProduct.sellingPrice ?? activeSimulatorProduct.selling_price ?? 0);
    const newSelling = Number(simNewPrice) || currentSelling;
    const marginRp = newSelling - base;
    const marginPct = base > 0 ? (marginRp / base) * 100 : 0;

    setSimResult({
      basePrice: base,
      currentSelling,
      newSelling,
      estMarginRp: marginRp,
      estMarginPct: Number(marginPct.toFixed(2))
    });
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'active' || s === 'tersedia') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Active
        </span>
      );
    }
    if (s === 'inactive' || s === 'nonaktif') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
          <XCircle className="w-3.5 h-3.5 text-gray-500" />
          Inactive
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
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
        <EyeOff className="w-3.5 h-3.5 text-purple-600" />
        Hidden
      </span>
    );
  };

  const pageCurrent = pricingPagination?.currentPage ?? pricingPagination?.current_page ?? currentPage;
  const pageLast = pricingPagination?.lastPage ?? pricingPagination?.last_page ?? 1;

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
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-xs text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
              <Tag className="w-3.5 h-3.5" />
              GurkyNet Operations Pricing & Margin Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Pricing & Margin Management
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
              Pusat peninjauan skema harga jual produk SKU, kalkulasi margin keuntungan operasional, kalkulator simulasi penetapan harga, dan riwayat perubahan harga.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(currentPage)}
              disabled={pricingLoading}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${pricingLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {pricingError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{pricingError}</span>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Total Products</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{totalProductsCount} SKU</div>
          <div className="text-[11px] text-gray-400">Total katalog terdaftar dalam sistem</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Average Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">Rp {avgMarginRp.toLocaleString('id-ID')}</div>
          <div className="text-[11px] text-gray-400">Rata-rata keuntungan per transaksi</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
            <span>Active SKU Count</span>
            <Tag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">
            {pricingProducts.filter(p => String(p.status).toLowerCase() === 'active').length} Active
          </div>
          <div className="text-[11px] text-gray-400">Siap diperjualbelikan oleh publik</div>
        </div>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Pricing & Margin Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {pricingProducts.length} of {totalProductsCount} Items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Kategori</option>
              <option value="pulsa">Pulsa</option>
              <option value="data">Data</option>
              <option value="pln">PLN Token</option>
              <option value="ewallet">E-Wallet</option>
              <option value="game">Game Voucher</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Product Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                handleFilterChange();
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
                handleFilterChange();
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keyword Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleFilterChange();
                }}
                placeholder="Cari kode SKU, nama produk..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PRICING TABLE SECTION */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Pricing & Margin Table</h2>
            <p className="text-xs text-gray-500">Skema harga real-time dari database operasional GurkyNet</p>
          </div>
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-mono">
            {pricingProducts.length} SKU
          </span>
        </div>

        {pricingLoading ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat data penetapan harga...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Product Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Base Price</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Margin (Rp)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {pricingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      Tidak ada data skema harga yang memenuhi kriteria filter.
                    </td>
                  </tr>
                ) : (
                  pricingProducts.map((item: any) => {
                    const code = item.code || item.id;
                    const name = item.name || item.title || '-';
                    const category = item.category || '-';
                    const provider = item.provider || item.provider_name || '-';
                    const basePrice = Number(item.basePrice ?? item.base_price ?? 0);
                    const sellingPrice = Number(item.sellingPrice ?? item.selling_price ?? 0);
                    const marginRp = Number(item.margin ?? (sellingPrice - basePrice));
                    const status = item.status || 'Active';

                    return (
                      <tr
                        key={code}
                        className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                        onClick={() => setSelectedProduct(item)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                          {code}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-gray-900 max-w-xs truncate">{name}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-[11px]">
                            {category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-blue-700">
                          {provider}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          Rp {basePrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-gray-900">
                          Rp {sellingPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-emerald-700">
                          +Rp {marginRp.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(status)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-600 transition"
                              title="View Detail"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingPricing(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                              title="Edit Price"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
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

        {/* PAGINATION CONTROLS */}
        {pageLast > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
            <span className="text-gray-500 font-medium">
              Halaman {pageCurrent} dari {pageLast}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pageCurrent <= 1 || pricingLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pageLast, prev + 1))}
                disabled={pageCurrent >= pageLast || pricingLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PRICE SIMULATOR SECTION */}
      {activeSimulatorProduct && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-gray-900">Price Simulator</h2>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-mono font-bold">
              Margin Estimator
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-xs">
              <div>
                <label className="block font-extrabold text-gray-700 mb-1">Target SKU Sample</label>
                <div className="font-mono font-bold text-indigo-700 text-sm">
                  {activeSimulatorProduct.code || activeSimulatorProduct.id} - {activeSimulatorProduct.name}
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Rencana Harga Jual Baru</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono font-bold text-gray-400">Rp</span>
                  <input
                    type="number"
                    value={simNewPrice || Number(activeSimulatorProduct.sellingPrice ?? activeSimulatorProduct.selling_price ?? 0)}
                    onChange={(e) => setSimNewPrice(Number(e.target.value))}
                    className="w-full bg-white border border-emerald-300 rounded-xl pl-10 pr-3 py-2 font-mono font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculateSimulation}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
              >
                <Calculator className="w-4 h-4" />
                <span>Kalkulasi Margin</span>
              </button>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-emerald-400 border-b border-slate-800 pb-2">
                  SIMULATOR OUTPUT
                </div>

                {simResult ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-800 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Base Price</span>
                        <span className="font-mono font-bold">Rp {simResult.basePrice.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="bg-slate-800 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">New Price</span>
                        <span className="font-mono font-bold text-emerald-400">Rp {simResult.newSelling.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-emerald-200">Estimasi Margin:</span>
                        <span className="font-mono font-black text-emerald-300">+Rp {simResult.estMarginRp.toLocaleString('id-ID')} (+{simResult.estMarginPct}%)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    Klik <strong>Kalkulasi Margin</strong> untuk menghitung estimasi.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedProduct.code || selectedProduct.id}
                  </span>
                  {getStatusBadge(selectedProduct.status || 'Active')}
                </div>
                <h2 className="text-lg font-extrabold">{selectedProduct.name || selectedProduct.title}</h2>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-800 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Base Price</span>
                  <div className="font-mono font-extrabold text-gray-800 mt-0.5">
                    Rp {Number(selectedProduct.basePrice ?? selectedProduct.base_price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Selling Price</span>
                  <div className="font-mono font-black text-gray-900 mt-0.5">
                    Rp {Number(selectedProduct.sellingPrice ?? selectedProduct.selling_price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Margin</span>
                  <div className="font-mono font-black text-emerald-700 mt-0.5">
                    +Rp {(Number(selectedProduct.sellingPrice ?? selectedProduct.selling_price ?? 0) - Number(selectedProduct.basePrice ?? selectedProduct.base_price ?? 0)).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Provider</span>
                  <div className="font-extrabold text-blue-700 mt-0.5">{selectedProduct.provider || selectedProduct.provider_name || '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Catatan Operasional:</h3>
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedProduct.notes || selectedProduct.description || 'Tidak ada catatan.'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingPricing(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Harga</span>
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRICING MODAL */}
      {editingPricing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900 text-base">Edit Skema Harga ({editingPricing.code || editingPricing.id})</h3>
              </div>
              <button
                onClick={() => setEditingPricing(null)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Base Price (Harga Modal)</label>
                <input
                  type="number"
                  value={editingPricing.basePrice ?? editingPricing.base_price ?? 0}
                  onChange={(e) => setEditingPricing({ ...editingPricing, basePrice: Number(e.target.value), base_price: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Selling Price (Harga Jual)</label>
                <input
                  type="number"
                  value={editingPricing.sellingPrice ?? editingPricing.selling_price ?? 0}
                  onChange={(e) => setEditingPricing({ ...editingPricing, sellingPrice: Number(e.target.value), selling_price: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Catatan</label>
                <textarea
                  value={editingPricing.notes || editingPricing.description || ''}
                  onChange={(e) => setEditingPricing({ ...editingPricing, notes: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPricing(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pricingLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{pricingLoading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
