import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle2,
  XCircle,
  Wrench,
  EyeOff,
  AlertTriangle,
  X,
  RefreshCw,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { operationsService } from '../../services/operations.service';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

function resolveOpsStatus(item: any): string {
  const raw =
    item?.availabilityStatus ||
    item?.availability_status ||
    item?.opsStatus ||
    item?.ops_status ||
    item?.status ||
    'active';
  const s = String(raw).toLowerCase();
  if (s === 'active' || s === 'tersedia' || s === '1' || s === 'true') return 'active';
  if (s === 'inactive' || s === 'nonaktif' || s === 'gangguan' || s === '0' || s === 'false') return 'inactive';
  if (s === 'maintenance') return 'maintenance';
  return s;
}

export const OperationsProductManagement: React.FC = () => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada modul Operations.
  const isOwnerReadOnly = useOwnerReadOnly();
  const {
    products,
    productsPagination,
    productsLoading,
    productsError,
    fetchProducts,
    updateProduct
  } = useOperationsStore();

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [providerFilter, setProviderFilter] = useState<string>('All');
  const [productProviders, setProductProviders] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Debounce search → backend (no page reload, no frontend catalog filter)
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

  const loadData = useCallback((page: number = 1) => {
    const params: Record<string, any> = {
      page,
      per_page: 25,
      sort: 'newest',
    };
    if (categoryFilter !== 'All') params.category = categoryFilter;
    if (providerFilter !== 'All') params.product_provider_id = Number(providerFilter);
    if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();
    if (searchQuery !== '') params.search = searchQuery;

    fetchProducts(params);
  }, [categoryFilter, providerFilter, statusFilter, searchQuery, fetchProducts]);

  useEffect(() => {
    loadData(currentPage);
  }, [loadData, currentPage]);

  const handleFilterChange = (nextPage = 1) => {
    setCurrentPage(nextPage);
  };

  const handleToggleProductStatus = async (item: any, newStatus: string) => {
    const productId = item.id || item.code;
    const result = await updateProduct(productId, { status: newStatus.toLowerCase() });
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || `Status SKU ${item.code || item.id} berhasil diperbarui.` });
      loadData(currentPage);
      if (selectedProduct && (selectedProduct.id === productId || selectedProduct.code === productId)) {
        setSelectedProduct({ ...selectedProduct, status: newStatus.toLowerCase(), availabilityStatus: newStatus.toLowerCase() });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal mengubah status produk.' });
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const productId = editingProduct.id || editingProduct.code;
    const statusValue = String(editingProduct.status || 'active').toLowerCase();
    const payload = {
      name: editingProduct.name,
      base_price: Number(editingProduct.basePrice ?? editingProduct.base_price ?? 0),
      selling_price: Number(editingProduct.sellingPrice ?? editingProduct.selling_price ?? 0),
      status: statusValue,
      description: editingProduct.description,
    };

    const result = await updateProduct(productId, payload);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message || 'Produk berhasil disimpan.' });
      setEditingProduct(null);
      loadData(currentPage);
      if (selectedProduct && (selectedProduct.id === productId || selectedProduct.code === productId)) {
        setSelectedProduct({ ...selectedProduct, ...payload, availabilityStatus: statusValue });
      }
    } else {
      setActionMessage({ type: 'error', text: result.message || 'Gagal menyimpan perubahan produk.' });
    }
  };

  const totalCount = productsPagination?.total ?? products.length;
  const pageCurrent = productsPagination?.currentPage ?? productsPagination?.current_page ?? currentPage;
  const pageLast = productsPagination?.lastPage ?? productsPagination?.last_page ?? 1;

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
    if (s === 'inactive' || s === 'nonaktif' || s === 'gangguan') {
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

  return (
    <div className="space-y-6 pb-12">
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

      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-xs text-[11px] font-bold text-indigo-200 border border-indigo-400/30">
              <Layers className="w-3.5 h-3.5" />
              GurkyNet Operations Product Catalog
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Product Management
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
              Control Center katalog produk real dari Digiflazz & VIP Payment. Filter, harga, dan status di sini langsung mempengaruhi Dashboard User.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(currentPage)}
              disabled={productsLoading}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${productsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {productsError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{productsError}</span>
        </div>
      )}

      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Katalog Product Filter Bar</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Showing {totalCount.toLocaleString('id-ID')} Products
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                handleFilterChange(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">Semua Kategori</option>
              <option value="pulsa">Pulsa</option>
              <option value="data">Paket Data</option>
              <option value="pln">PLN Token</option>
              <option value="topup-digital">E-Wallet</option>
              <option value="voucher-digital">Voucher Digital</option>
              <option value="game">Game</option>
              <option value="langganan-digital">Langganan Digital</option>
              <option value="tagihan">Tagihan</option>
              <option value="voucher-internet">Voucher Internet</option>
              <option value="international">International</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Product Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                handleFilterChange(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                handleFilterChange(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">Semua Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keyword Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nama, SKU, operator, provider..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Product Management Table</h2>
            <p className="text-xs text-gray-500">Daftar SKU produk real-time dari database operasional GurkyNet</p>
          </div>
          <span className="text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono">
            {products.length} / {totalCount.toLocaleString('id-ID')} Items
          </span>
        </div>

        {productsLoading ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Memuat katalog produk...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Product Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Product Provider</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Base Price</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((item: any) => {
                    const code = item.code || item.id;
                    const name = item.name || item.title || '-';
                    const category = item.category || '-';
                    const productProvider = item.productProvider || item.product_provider || '-';
                    const operator = item.provider || item.provider_name || item.operatorName || '-';
                    const basePrice = Number(item.basePrice ?? item.base_price ?? item.price ?? 0);
                    const sellingPrice = Number(item.sellingPrice ?? item.selling_price ?? item.price ?? 0);
                    const margin = Number(item.margin ?? (sellingPrice - basePrice));
                    const status = resolveOpsStatus(item);

                    return (
                      <tr
                        key={code}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                        onClick={() => setSelectedProduct(item)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                          {code}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-gray-900 max-w-xs truncate">{name}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-xs">{item.description || '-'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-[11px]">
                            {category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-700">
                          {productProvider}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-blue-700">
                          {operator}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          Rp {basePrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-gray-900 font-mono">
                          Rp {sellingPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-700 font-mono">
                          +Rp {margin.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(status)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(item)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 transition"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!isOwnerReadOnly && (
                              <button
                                type="button"
                                onClick={() => setEditingProduct({
                                  ...item,
                                  status: resolveOpsStatus(item),
                                })}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition"
                                title="Edit Product"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isOwnerReadOnly && (status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleProductStatus(item, 'inactive')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-amber-600 hover:text-white text-amber-700 transition"
                                title="Disable Product"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleProductStatus(item, 'active')}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-600 hover:text-white text-emerald-700 transition"
                                title="Enable Product"
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            ))}
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
              Halaman {pageCurrent} dari {pageLast} · {totalCount.toLocaleString('id-ID')} Products
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={pageCurrent <= 1 || productsLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pageLast, prev + 1))}
                disabled={pageCurrent >= pageLast || productsLoading}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedProduct.code || selectedProduct.id}
                  </span>
                  {getStatusBadge(resolveOpsStatus(selectedProduct))}
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
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Product Code</span>
                  <div className="font-mono font-extrabold text-indigo-700 mt-0.5">{selectedProduct.code || selectedProduct.id}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Category</span>
                  <div className="font-extrabold text-gray-900 mt-0.5">{selectedProduct.category || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Product Provider</span>
                  <div className="font-extrabold text-indigo-700 mt-0.5">{selectedProduct.productProvider || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Operator</span>
                  <div className="font-extrabold text-blue-700 mt-0.5">{selectedProduct.provider || selectedProduct.operatorName || '-'}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Status</span>
                  <div className="mt-0.5">{getStatusBadge(resolveOpsStatus(selectedProduct))}</div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Base Price</span>
                  <div className="font-mono font-extrabold text-gray-800 mt-0.5">
                    Rp {Number(selectedProduct.basePrice ?? selectedProduct.base_price ?? selectedProduct.price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Selling Price</span>
                  <div className="font-mono font-black text-gray-900 mt-0.5">
                    Rp {Number(selectedProduct.sellingPrice ?? selectedProduct.selling_price ?? selectedProduct.price ?? 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-900 text-xs mb-1">Deskripsi Produk:</h3>
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed font-medium">
                  {selectedProduct.description || 'Tidak ada deskripsi tambahan.'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
              {!isOwnerReadOnly && (
                <button
                  onClick={() => {
                    setEditingProduct({ ...selectedProduct, status: resolveOpsStatus(selectedProduct) });
                    setSelectedProduct(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Produk</span>
                </button>
              )}
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

      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900 text-base">Edit Product ({editingProduct.code || editingProduct.id})</h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nama Produk</label>
                <input
                  type="text"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Base Price (Harga Modal)</label>
                  <input
                    type="number"
                    value={editingProduct.basePrice ?? editingProduct.base_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, basePrice: Number(e.target.value), base_price: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Selling Price (Harga Jual)</label>
                  <input
                    type="number"
                    value={editingProduct.sellingPrice ?? editingProduct.selling_price ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: Number(e.target.value), selling_price: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Status</label>
                <select
                  value={String(editingProduct.status || 'active').toLowerCase()}
                  onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={productsLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{productsLoading ? 'Menyimpan...' : 'Simpan Produk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
