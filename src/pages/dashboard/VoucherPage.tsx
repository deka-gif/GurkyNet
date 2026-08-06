import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, 
  Tag, 
  Gamepad2, 
  Tv, 
  ShoppingBag, 
  Coffee, 
  Fuel, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Wallet,
  X,
  Search,
  ChevronRight,
  Barcode,
  RefreshCw
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';

export const VoucherPage = () => {
  const { wallet, fetchWallet, deductBalance } = useWalletStore();
  const { createTransaction } = useTransactionStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'digital' | 'fisik'>('digital');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Product | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);

  // Status Banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category: 'voucher' }); // Fetch products with category voucher
    const pending = consumePendingCheckout('/dashboard/voucher');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts]);

  

  // Filter Catalog using backend products
  const filteredCatalog = useMemo(() => {
    return products.filter(v => {
      // API products might not have 'type' or 'category' exact matches, we adapt based on name or operatorName
      const isFisik = v.name.toLowerCase().includes('fisik') || v.name.toLowerCase().includes('cetak');
      const matchType = (activeTab === 'fisik' && isFisik) || (activeTab === 'digital' && !isFisik);
      
      const vCat = v.category || 'game'; 
      const matchCategory = activeCategory === 'all' || vCat.includes(activeCategory) || v.name.toLowerCase().includes(activeCategory);
      
      const matchSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.operatorName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchType && matchCategory && matchSearch && v.status === 'tersedia';
    });
  }, [products, activeTab, activeCategory, searchQuery]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'game': return <Gamepad2 className="w-4 h-4" />;
      case 'streaming': return <Tv className="w-4 h-4" />;
      case 'shopping': return <ShoppingBag className="w-4 h-4" />;
      case 'food': return <Coffee className="w-4 h-4" />;
      case 'fuel': return <Fuel className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="vouchers-page-root">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Katalog Voucher Belanja</h2>
          <p className="text-sm text-gray-500">Miliki voucher digital hiburan terpopuler atau voucher fisik ritel belanja terlengkap.</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3.5"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-emerald-900 text-sm">Pembelian Voucher Sukses!</h5>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500 hover:text-emerald-800">Tutup</button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3.5"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-red-900 text-sm">Masalah Pembayaran</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Sub-tabs: Digital vs Fisik */}
      <div className="flex border-b border-gray-100 gap-6">
        <button
          onClick={() => {
            setActiveTab('digital');
            setActiveCategory('all');
            setSelectedVoucher(null);
            setGeneratedCode(null);
          }}
          className={`pb-4 font-black text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'digital' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <Gift className="w-4 h-4" />
          <span>Voucher Digital / E-Voucher</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('fisik');
            setActiveCategory('all');
            setSelectedVoucher(null);
            setGeneratedCode(null);
          }}
          className={`pb-4 font-black text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'fisik' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Voucher Belanja Fisik</span>
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Category Horizontal Filter Pill */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none w-full md:w-auto">
          {[
            { key: 'all', label: 'Semua Kategori' },
            { key: 'game', label: 'Gaming' },
            { key: 'streaming', label: 'Streaming' },
            { key: 'shopping', label: 'Shopping' },
            { key: 'food', label: 'Kuliner' },
            { key: 'fuel', label: 'Bahan Bakar' }
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                activeCategory === cat.key 
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Cari voucher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
      </div>

      {/* Grid Catalog Display */}
      {productsLoading ? (
        <div className="p-16 text-center border border-dashed border-gray-200 bg-white rounded-3xl space-y-2">
          <RefreshCw className="w-10 h-10 mx-auto text-gray-300 animate-spin" />
          <h5 className="font-extrabold text-gray-700 text-sm">Memuat Data Voucher</h5>
          <p className="text-xs text-gray-400">Harap tunggu sebentar...</p>
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-gray-200 bg-white rounded-3xl space-y-2">
          <Gift className="w-10 h-10 mx-auto text-gray-300" />
          <h5 className="font-extrabold text-gray-700 text-sm">Voucher Tidak Ditemukan</h5>
          <p className="text-xs text-gray-400">Tidak ada item voucher yang cocok dengan filter atau kata pencarian Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredCatalog.map((vch) => (
            <div 
              key={vch.id}
              onClick={() => {
                setCheckoutData({
                  serviceName: activeTab === 'digital' ? 'Voucher Digital' : 'Voucher Fisik',
                  productName: vch.name,
                  targetNo: wallet?.walletNo || 'GurkyPay Wallet',
                  amount: vch.price,
                  adminFee: 0,
                  skuCode: vch.code,
                  customDetails: {
                    'Brand': vch.operatorName || 'Voucher',
                    'Tipe Voucher': activeTab.toUpperCase()
                  }
                });
              }}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xl shadow-gray-200/20 hover:border-primary-100 cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Brand card representation */}
                <div className={`h-36 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 text-white flex flex-col justify-between relative overflow-hidden`}>
                  <div className="absolute right-4 bottom-4 opacity-5">
                    <Gift className="w-24 h-24" />
                  </div>
                  
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black tracking-widest uppercase bg-white/20 px-2.5 py-1 rounded-full">{vch.operatorName || 'Voucher'}</span>
                  </div>
                  
                  <div>
                    <span className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Voucher Nominal</span>
                    <h5 className="text-xl font-black mt-0.5">{vch.name}</h5>
                  </div>
                </div>

                <div className="mt-4">
                  <h6 className="font-black text-gray-900 text-sm leading-snug group-hover:text-primary-600 transition-colors">{vch.name}</h6>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                  {getCategoryIcon(vch.category || 'game')}
                  <span>{vch.category || 'Voucher'}</span>
                </div>
                <span className="text-sm font-black text-primary-600">{formatIDR(vch.price)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={resumePin ? 'PIN' : 'SUMMARY'}
          onClose={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
          onSuccess={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
        />
      )}

    </div>
  );
};
