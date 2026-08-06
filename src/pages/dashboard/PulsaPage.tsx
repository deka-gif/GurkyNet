import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Wallet,
  Coins,
  History,
  CornerDownRight,
  RefreshCw
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';
import { operatorsMatch } from '../../utils/operatorMatch';

export const PulsaPage = () => {
  const { wallet, fetchWallet } = useWalletStore();
  const { createTransaction } = useTransactionStore();
  const { products, loading: productsLoading, fetchProducts, getProductsByCategory } = useProductStore();

  const [phoneNo, setPhoneNo] = useState<string>('');
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);

  // Status Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category: 'pulsa' });
  }, [fetchWallet, fetchProducts]);

  // Prefix check to auto-detect operator/provider
  useEffect(() => {
    const cleanNo = phoneNo.replace(/\D/g, '');
    if (cleanNo.length >= 4) {
      const prefix = cleanNo.slice(0, 4);
      if (['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823'].includes(prefix)) {
        setProvider('Telkomsel');
      } else if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(prefix)) {
        setProvider('Indosat Ooredoo');
      } else if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(prefix)) {
        setProvider('XL Axiata');
      } else if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) {
        setProvider('Tri (3)');
      } else if (['0831', '0832', '0833', '0838'].includes(prefix)) {
        setProvider('Axis');
      } else if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(prefix)) {
        setProvider('Smartfren');
      } else {
        setProvider('Operator Lain');
      }
    } else {
      setProvider(null);
      setSelectedProduct(null);
    }
  }, [phoneNo]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleCheckout = async () => {
    if (!provider) {
      setErrorMsg('Tolong masukkan nomor HP yang valid terlebih dahulu.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Pilih nominal pulsa yang ingin Anda beli.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembelian ini.');
      return;
    }

    // Assuming product.price is the final price for user, we don't have exact nominal in backend schema. 
    // We will pass the sku_code and base amount derived from name for UI.
    const nominalString = selectedProduct.name.replace(/\D/g, '');
    const nominal = nominalString ? parseInt(nominalString) : selectedProduct.price;

    setCheckoutData({
      serviceName: 'Pulsa',
      productName: selectedProduct.name,
      targetNo: phoneNo,
      amount: nominal,
      adminFee: selectedProduct.price - nominal,
      skuCode: selectedProduct.code,
      customDetails: {
        'Operator': selectedProduct.operatorName
      }
    });
  };

  // Get products based on selected provider (VIP brands may differ in casing/label)
  const displayProducts = provider
    ? products.filter((p) => operatorsMatch(p.operatorName, provider) && p.status === 'tersedia')
    : [];

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="pulsa-page-root">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Isi Pulsa Seluler</h2>
          <p className="text-sm text-gray-500">Beli pulsa instan ke semua operator Indonesia dengan harga agen paling murah.</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Success and Error Banners */}
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
              <h5 className="font-bold text-emerald-900 text-sm">Pembelian Berhasil!</h5>
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
              <h5 className="font-bold text-red-900 text-sm">Kesalahan Transaksi</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Phone Number and Operator detected */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
          <div className="space-y-2">
            <h4 className="font-extrabold text-gray-900 text-base">Detail Nomor Penerima</h4>
            <p className="text-xs text-gray-500">Provider seluler dideteksi secara otomatis saat Anda mengetikkan 4 digit nomor pertama.</p>
          </div>

          {/* Phone input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">Nomor Handphone</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Smartphone className="w-5 h-5 text-gray-400" />
              </div>
              <input 
                type="tel"
                placeholder="Contoh: 081234567890"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
              />
              {provider && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="bg-primary-50 text-primary-700 font-extrabold text-xs px-3 py-1.5 rounded-xl border border-primary-100">
                    {provider}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Nominal Grid Options */}
          <div className="space-y-4">
            <h5 className="font-extrabold text-gray-900 text-sm">Pilih Nominal Pulsa</h5>
            
            {!provider ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                <Smartphone className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs font-medium">Ketik nomor HP Anda terlebih dahulu untuk memunculkan daftar nominal.</p>
              </div>
            ) : productsLoading ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                 <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
                 <p className="text-xs font-medium">Memuat daftar produk...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="p-10 border border-dashed border-gray-200 rounded-3xl text-center text-gray-400 space-y-2">
                 <AlertCircle className="w-8 h-8 mx-auto text-gray-300" />
                 <p className="text-xs font-medium">Produk tidak tersedia untuk operator ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                {displayProducts.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedProduct(opt)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                      selectedProduct?.id === opt.id 
                        ? 'bg-primary-50/40 border-primary-500 ring-2 ring-primary-500/20 shadow-md' 
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{opt.operatorName}</span>
                      <h4 className="font-extrabold text-gray-900 text-sm mt-0.5 leading-tight">
                        {opt.name}
                      </h4>
                    </div>
                    <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between w-full">
                      <span className="text-[10px] text-gray-500">Harga Agen</span>
                      <span className="text-xs font-black text-primary-600">{formatIDR(opt.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Checkout Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 flex flex-col justify-between h-fit">
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <h4 className="font-extrabold text-gray-900 text-base">Ringkasan Pembelian</h4>
              <p className="text-xs text-gray-500 mt-1">Verifikasi kembali pesanan pulsa Anda sebelum melunasi pembayaran.</p>
            </div>

            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Nomor Tujuan</span>
                  <span className="text-gray-900">{phoneNo || '-'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Operator</span>
                  <span className="text-gray-900">{selectedProduct.operatorName}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Produk</span>
                  <span className="text-gray-900 text-right ml-4">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Metode Pembayaran</span>
                  <span className="text-primary-600">Saldo GurkyPay</span>
                </div>

                <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">Total Tagihan</span>
                  <span className="text-xl font-black text-primary-600">{formatIDR(selectedProduct.price)}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 space-y-1.5">
                <p className="text-xs font-medium">Silakan pilih nomor HP dan nominal pulsa di panel kiri untuk melihat rincian checkout.</p>
              </div>
            )}
          </div>

          <button
            disabled={loading || !selectedProduct}
            onClick={handleCheckout}
            className={`w-full mt-6 py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white transition-all flex items-center justify-center gap-2 ${
              loading 
                ? 'bg-primary-400 cursor-not-allowed' 
                : selectedProduct 
                ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/10' 
                : 'bg-gray-200 cursor-not-allowed text-gray-400'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Transaksi...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Beli Sekarang</span>
              </>
            )}
          </button>
        </div>

      </div>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          onClose={() => setCheckoutData(null)}
          onSuccess={() => {
            setPhoneNo('');
            setSelectedProduct(null);
            setCheckoutData(null);
          }}
        />
      )}

    </div>
  );
};
