import React, { useState } from 'react';
import { 
  Database, Tag, Layers, Percent, AlertCircle, Save, 
  Upload, Download, Plus, Edit2, CheckCircle2, Sliders, ToggleLeft, ToggleRight
} from 'lucide-react';
import { AdminProduct, SystemSettings } from '../types';

interface ProductSettingsProps {
  products: AdminProduct[];
  settings: SystemSettings;
  onUpdateProduct: (id: string, updates: Partial<AdminProduct>) => void;
  onAddProduct: (product: Omit<AdminProduct, 'id'>) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
}

export const AdminProductSettings: React.FC<ProductSettingsProps> = ({ 
  products, settings, onUpdateProduct, onAddProduct, onUpdateSettings 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'settings'>('products');
  
  // Product list filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [productSearch, setProductSearch] = useState('');

  // Bulk import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Modal / Add product state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('pulsa');
  const [newProv, setNewProv] = useState('Telkomsel');
  const [newPrice, setNewPrice] = useState(0);
  const [newMargin, setNewMargin] = useState(0);

  // Local settings states
  const [dfUser, setDfUser] = useState(settings.digiflazzUsername);
  const [dfKey, setDfKey] = useState(settings.digiflazzApiKey);
  const [dfProd, setDfProd] = useState(settings.digiflazzProductionMode);
  const [midClient, setMidClient] = useState(settings.midtransClientKey);
  const [midServer, setMidServer] = useState(settings.midtransServerKey);
  const [midSandbox, setMidSandbox] = useState(settings.midtransSandboxMode);
  const [marginGlobal, setMarginGlobal] = useState(settings.marginGlobal);
  const [maintenance, setMaintenance] = useState(settings.maintenanceMode);
  const [flags, setFlags] = useState(settings.featureFlags);

  // Lists for dropdown options
  const categories = ['All', 'pulsa', 'data', 'pln', 'ewallet', 'voucher', 'game', 'transfer', 'tagihan'];
  const providers = ['All', 'Telkomsel', 'Indosat Ooredoo', 'XL Axiata', 'PLN', 'GoPay', 'ShopeePay', 'OVO'];

  const handleSaveProductChanges = (id: string, field: keyof AdminProduct, value: any) => {
    onUpdateProduct(id, { [field]: value });
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName) return;
    onAddProduct({
      skuCode: newSku,
      name: newName,
      category: newCat,
      provider: newProv,
      price: Number(newPrice),
      margin: Number(newMargin),
      status: 'tersedia'
    });
    // Reset
    setNewSku('');
    setNewName('');
    setNewPrice(0);
    setNewMargin(0);
    setShowAddProduct(false);
  };

  // Bulk Export (Downloads CSV simulation)
  const triggerBulkExport = () => {
    const headers = 'ID,SKU Code,Name,Category,Provider,Price,Margin,Status\n';
    const rows = products.map(p => 
      `"${p.id}","${p.skuCode}","${p.name}","${p.category}","${p.provider}",${p.price},${p.margin},"${p.status}"`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'gurkypay_products_export.csv');
    a.click();
  };

  // Bulk Import
  const handleBulkImport = () => {
    if (!importText) {
      setImportFeedback('Format kosong. Harap isi data terlebih dahulu.');
      return;
    }

    try {
      const lines = importText.split('\n').filter(l => l.trim() !== '');
      let parsedCount = 0;

      lines.forEach((line, idx) => {
        // Simple comma split, skip header if present
        if (idx === 0 && line.toLowerCase().includes('sku')) return;
        
        const parts = line.split(',');
        if (parts.length >= 6) {
          const skuCode = parts[0].trim().replace(/"/g, '');
          const name = parts[1].trim().replace(/"/g, '');
          const category = parts[2].trim().replace(/"/g, '');
          const provider = parts[3].trim().replace(/"/g, '');
          const price = parseFloat(parts[4].trim());
          const margin = parseFloat(parts[5].trim());

          onAddProduct({
            skuCode,
            name,
            category,
            provider,
            price: isNaN(price) ? 10000 : price,
            margin: isNaN(margin) ? 250 : margin,
            status: 'tersedia'
          });
          parsedCount++;
        }
      });

      setImportFeedback(`Berhasil mengimpor ${parsedCount} produk baru secara masal!`);
      setImportText('');
      setTimeout(() => {
        setShowImport(false);
        setImportFeedback(null);
      }, 2500);
    } catch (e) {
      setImportFeedback('Gagal memproses file. Pastikan format CSV valid: SKU,Nama,Kategori,Provider,Harga,Margin');
    }
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      digiflazzUsername: dfUser,
      digiflazzApiKey: dfKey,
      digiflazzProductionMode: dfProd,
      midtransClientKey: midClient,
      midtransServerKey: midServer,
      midtransSandboxMode: midSandbox,
      marginGlobal: Number(marginGlobal),
      maintenanceMode: maintenance,
      featureFlags: flags
    });
  };

  // Filters calculation
  const filteredProducts = products.filter(p => {
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesProv = providerFilter === 'All' || p.provider === providerFilter;
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(productSearch.toLowerCase());
    return matchesCat && matchesProv && matchesSearch;
  });

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs header */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 tracking-wide uppercase flex items-center gap-2 transition ${
            activeSubTab === 'products' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Database size={14} />
          Product Catalog &amp; Margin
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 tracking-wide uppercase flex items-center gap-2 transition ${
            activeSubTab === 'settings' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sliders size={14} />
          Gateway &amp; Global Settings
        </button>
      </div>

      {/* RENDER VIEW 1: PRODUCTS CATALOG */}
      {activeSubTab === 'products' && (
        <div className="space-y-6">
          {/* Controls bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Cari produk / SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-800"
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-700 font-semibold"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'All' ? 'Semua Kategori' : c.toUpperCase()}</option>
                ))}
              </select>

              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-700 font-semibold"
              >
                {providers.map(p => (
                  <option key={p} value={p}>{p === 'All' ? 'Semua Provider' : p}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={() => setShowImport(!showImport)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95 border border-gray-200"
              >
                <Upload size={13} />
                <span>Bulk Import</span>
              </button>

              <button
                onClick={triggerBulkExport}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95 border border-gray-200"
              >
                <Download size={13} />
                <span>Bulk Export</span>
              </button>

              <button
                onClick={() => setShowAddProduct(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Plus size={14} />
                <span>Produk</span>
              </button>
            </div>
          </div>

          {/* Bulk Import Pasting panel */}
          {showImport && (
            <div className="bg-slate-50 border border-indigo-100 p-5 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Upload size={14} className="text-indigo-600" />
                Bulk Import CSV Parser
              </h4>
              <p className="text-[11px] text-gray-500">
                Tempel data produk berformat CSV baris demi baris di bawah ini dengan format: 
                <code className="bg-white px-1.5 py-0.5 rounded border ml-1 font-mono text-[10px]">SKU,NamaProduk,Kategori,Provider,Harga,Margin</code>
              </p>
              
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="tsel20,Telkomsel 20K,pulsa,Telkomsel,20250,250&#10;xl_data10,XL Data 10GB,data,XL Axiata,85000,5000"
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 focus:outline-none focus:border-indigo-500"
              />

              {importFeedback && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  importFeedback.includes('Gagal') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  <CheckCircle2 size={14} />
                  {importFeedback}
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowImport(false)}
                  className="bg-white hover:bg-gray-100 text-gray-600 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-gray-200 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleBulkImport}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm transition active:scale-95"
                >
                  Proses &amp; Impor Masal
                </button>
              </div>
            </div>
          )}

          {/* Add product Modal Form overlay */}
          {showAddProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="bg-white w-full max-w-md rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Tambah SKU Produk Baru</h3>
                  <button onClick={() => setShowAddProduct(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Tutup</button>
                </div>
                <form onSubmit={handleAddProductSubmit} className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">SKU Code</label>
                      <input
                        type="text" required value={newSku} onChange={(e) => setNewSku(e.target.value)}
                        placeholder="e.g. tsel15" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nama Produk</label>
                      <input
                        type="text" required value={newName} onChange={(e) => setNewName(e.target.value)}
                        placeholder="Telkomsel 15.000" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kategori</label>
                      <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none">
                        {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Provider</label>
                      <select value={newProv} onChange={(e) => setNewProv(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none">
                        {providers.filter(p => p !== 'All').map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Harga Provider (IDR)</label>
                      <input
                        type="number" required value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Margin Keuntungan (IDR)</label>
                      <input
                        type="number" required value={newMargin} onChange={(e) => setNewMargin(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddProduct(false)} className="bg-gray-100 text-gray-600 text-xs font-bold px-4 py-2 rounded-lg">Batal</button>
                    <button type="submit" className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">SKU / Nama Produk</th>
                  <th className="px-6 py-3.5">Kategori &amp; Provider</th>
                  <th className="px-6 py-3.5">Harga Dasar (Digiflazz)</th>
                  <th className="px-6 py-3.5">Margin (IDR)</th>
                  <th className="px-6 py-3.5">Harga Jual User</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p.skuCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="bg-indigo-50 text-indigo-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-indigo-100 w-fit">
                          {p.category}
                        </span>
                        <span className="text-gray-500 font-bold">{p.provider}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-900">
                      {formatIDR(p.price)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 max-w-[100px]">
                        <Percent size={12} className="text-gray-400 shrink-0" />
                        <input
                          type="number"
                          value={p.margin}
                          onChange={(e) => handleSaveProductChanges(p.id, 'margin', Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-xs font-mono font-bold text-gray-800 focus:bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-600 font-bold">
                      {formatIDR(p.price + p.margin)}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={p.status}
                        onChange={(e) => handleSaveProductChanges(p.id, 'status', e.target.value)}
                        className={`border rounded px-2.5 py-1 text-[11px] font-bold focus:outline-none ${
                          p.status === 'tersedia' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <option value="tersedia">Tersedia</option>
                        <option value="gangguan">Gangguan</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER VIEW 2: GATEWAY & SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSettingsSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Digiflazz Integration Panel */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Layers className="text-indigo-600" size={16} />
                Digiflazz API Integration (PPOB Gateway)
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Digiflazz Username</label>
                  <input
                    type="text" value={dfUser} onChange={(e) => setDfUser(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Digiflazz API Key</label>
                  <input
                    type="password" value={dfKey} onChange={(e) => setDfKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">Production Mode</span>
                    <span className="text-[10px] text-gray-400 block">Aktifkan untuk memproses transaksi rill langsung ke operator.</span>
                  </div>
                  <button
                    type="button" onClick={() => setDfProd(!dfProd)}
                    className="text-indigo-600 focus:outline-none"
                  >
                    {dfProd ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Midtrans Payment Gateway Panel */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Sliders className="text-indigo-600" size={16} />
                Midtrans API Integration (Top Up Gateway)
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Midtrans Client Key</label>
                  <input
                    type="text" value={midClient} onChange={(e) => setMidClient(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Midtrans Server Key</label>
                  <input
                    type="password" value={midServer} onChange={(e) => setMidServer(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">Sandbox Mode</span>
                    <span className="text-[10px] text-gray-400 block">Gunakan transaksi simulasi lingkungan pengujian (Sandbox).</span>
                  </div>
                  <button
                    type="button" onClick={() => setMidSandbox(!midSandbox)}
                    className="text-indigo-600 focus:outline-none"
                  >
                    {midSandbox ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Global Margins & Maintenance Panel */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Percent className="text-indigo-600" size={16} />
                Global Margin &amp; Platform Controls
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Default Margin Global (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.1" value={marginGlobal} onChange={(e) => setMarginGlobal(Number(e.target.value))}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-mono font-bold w-32"
                    />
                    <span className="text-xs font-bold text-gray-500">Persen Keuntungan Tambahan untuk SKU Default</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg border border-red-100 bg-red-50/50">
                  <div className="max-w-[75%]">
                    <span className="text-xs font-bold text-red-900 block flex items-center gap-1">
                      <AlertCircle size={14} />
                      Maintenance Mode (Mode Pemeliharaan)
                    </span>
                    <span className="text-[10px] text-red-600 block mt-0.5 font-semibold">
                      PERINGATAN: Mengaktifkan mode ini akan menangguhkan akses seluruh modul order, checkout, dan top up untuk semua pengguna biasa.
                    </span>
                  </div>
                  <button
                    type="button" onClick={() => setMaintenance(!maintenance)}
                    className="text-red-600 focus:outline-none"
                  >
                    {maintenance ? <ToggleRight size={38} className="text-red-600" /> : <ToggleLeft size={38} className="text-gray-300" />}
                  </button>
                </div>
              </div>
            </div>

            {/* System Feature Flags Panel */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Sliders className="text-indigo-600" size={16} />
                Feature Flags (Sakelar Fitur)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer">
                  <input
                    type="checkbox" checked={flags.otpRequest}
                    onChange={(e) => setFlags({ ...flags, otpRequest: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">OTP on Login/Register</span>
                    <span className="text-[9px] text-gray-400 block">Wajibkan OTP via Whatsapp</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer">
                  <input
                    type="checkbox" checked={flags.autoRefund}
                    onChange={(e) => setFlags({ ...flags, autoRefund: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">Auto Refund on Fail</span>
                    <span className="text-[9px] text-gray-400 block">Kredit otomatis saat trx gagal</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer">
                  <input
                    type="checkbox" checked={flags.manualRetry}
                    onChange={(e) => setFlags({ ...flags, manualRetry: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">Allow Manual Retry</span>
                    <span className="text-[9px] text-gray-400 block">Tombol retry di panel admin</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer">
                  <input
                    type="checkbox" checked={flags.multiWallet}
                    onChange={(e) => setFlags({ ...flags, multiWallet: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">Multi-Wallet Support</span>
                    <span className="text-[9px] text-gray-400 block">Gunakan saldo poin &amp; rupiah</span>
                  </div>
                </label>
              </div>
            </div>

          </div>

          {/* Submit bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-bold text-gray-500">Simpan seluruh pengaturan gateway &amp; parameter global</span>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
