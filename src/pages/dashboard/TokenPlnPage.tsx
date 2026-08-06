import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Wallet,
  RefreshCw
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';

export const TokenPlnPage = () => {
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [customerId, setCustomerId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);

  // Status Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidCustomerId = customerId.length >= 11;

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category: 'pln' });
    const pending = consumePendingCheckout('/dashboard/token-pln');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts]);

  const displayProducts = products.filter(p => p.status === 'tersedia' && p.name.toLowerCase().includes('token'));

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleCheckout = async () => {
    if (!isValidCustomerId) {
      setErrorMsg('Tolong masukkan ID pelanggan PLN yang valid terlebih dahulu.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Silakan pilih nominal token yang ingin dibeli.');
      return;
    }
    
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembelian token PLN ini.');
      return;
    }

    setCheckoutData({
      serviceName: 'Token PLN',
      productName: selectedProduct.name,
      targetNo: customerId,
      amount: selectedProduct.price,
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        'Nomor Meter / ID Pelanggan': customerId
      }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="token-pln-page-root">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Token Listrik PLN</h2>
          <p className="text-sm text-gray-500">Beli token listrik prabayar PLN secara instan dengan biaya admin murah.</p>
        </div>
        <div className="bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-black text-amber-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Success and Error Alerts */}
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
              <h5 className="font-bold text-emerald-900 text-sm">Pembayaran Token Berhasil!</h5>
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
              <h5 className="font-bold text-red-900 text-sm">Transaksi Gagal</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side Form Panels */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-gray-700">Nomor Meter / ID Pelanggan PLN</label>
            <div className="relative">
              <Zap className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Contoh: 14028394819"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
              />
            </div>
          </div>

          {/* Nominal Selector Panel */}
          <div className="space-y-4">
            <h5 className="font-extrabold text-gray-900 text-sm">Pilih Nominal Token</h5>
            
            {!isValidCustomerId ? (
              <div className="p-12 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <Zap className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-medium">Tolong masukkan 11-12 digit ID Pelanggan PLN Anda terlebih dahulu.</p>
              </div>
            ) : productsLoading ? (
              <div className="p-12 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
                <p className="text-xs font-medium">Memuat daftar token PLN...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="p-12 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-medium">Produk token PLN tidak tersedia.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                {displayProducts.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedProduct(opt)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      selectedProduct?.id === opt.id 
                        ? 'bg-amber-50/20 border-amber-500 ring-2 ring-amber-500/20 shadow-md' 
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PLN Prabayar</span>
                      <h4 className="font-extrabold text-gray-900 text-lg mt-0.5">
                        {opt.name}
                      </h4>
                    </div>
                    <div className="mt-4 pt-2.5 border-t border-gray-100/80 flex items-center justify-between w-full text-[10px]">
                      <span className="font-black text-gray-800">{formatIDR(opt.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Pane Bill Summary Card */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 flex flex-col justify-between h-fit">
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <h4 className="font-extrabold text-gray-900 text-base">Rincian Pembayaran</h4>
              <p className="text-xs text-gray-500 mt-1">Verifikasi informasi meteran dan nominal tagihan listrik sebelum bertransaksi.</p>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>ID Pelanggan</span>
                  <span className="text-gray-900">{customerId || '-'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Nominal Token</span>
                  <span className="text-gray-900">{selectedProduct.name}</span>
                </div>

                <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">Total Tagihan</span>
                  <span className="text-xl font-black text-primary-600">{formatIDR(selectedProduct.price)}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 space-y-1.5">
                <p className="text-xs font-medium">Lengkapi pengisian ID Pelanggan dan nominal token di sebelah kiri.</p>
              </div>
            )}
          </div>

          <button
            disabled={!selectedProduct}
            onClick={handleCheckout}
            className={`w-full mt-6 py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white transition-all flex items-center justify-center gap-2 ${
              selectedProduct 
                ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/10' 
                : 'bg-gray-200 cursor-not-allowed text-gray-400'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Konfirmasi Pembayaran</span>
          </button>
        </div>

      </div>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={resumePin ? 'PIN' : 'SUMMARY'}
          onClose={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
          onSuccess={() => {
            setSuccessMsg('Pembelian token sedang diproses. Nomor token (SN) akan tersedia pada struk transaksi di halaman Riwayat setelah diterbitkan oleh provider.');
            setCustomerId('');
            setSelectedProduct(null);
            setCheckoutData(null);
            setResumePin(false);
          }}
        />
      )}

    </div>
  );
};
