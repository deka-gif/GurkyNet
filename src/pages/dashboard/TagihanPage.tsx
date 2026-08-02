import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Droplet, 
  Heart, 
  Globe, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Wallet,
  RefreshCw,
  Clock,
  User
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useTransactionStore } from '../../store/transaction.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';

interface BillDetail {
  customerName: string;
  month: string;
  billAmount: number;
  adminFee: number;
  fine: number; // Denda
  totalAmount: number;
}

export const TagihanPage = () => {
  const { wallet, fetchWallet } = useWalletStore();
  const { createTransaction } = useTransactionStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [activeTab, setActiveTab] = useState<'pdam' | 'bpjs' | 'internet' | 'pln_pasca'>('pdam');
  const [customerId, setCustomerId] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Query Result
  const [billDetails, setBillDetails] = useState<BillDetail | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);

  // Status indicators
  const [querying, setQuerying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    let category = activeTab as string;
    if (activeTab === 'pln_pasca') category = 'pln';
    fetchProducts({ category });
  }, [activeTab, fetchProducts]);

  useEffect(() => {
    // Auto-select first product when products load
    const available = products.filter(p => p.status === 'tersedia');
    if (available.length > 0) {
      // If pln_pasca, find the one that says pasca
      if (activeTab === 'pln_pasca') {
        const pasca = available.find(p => p.name.toLowerCase().includes('pasca'));
        setSelectedProduct(pasca || available[0]);
      } else {
        setSelectedProduct(available[0]);
      }
    } else {
      setSelectedProduct(null);
    }
  }, [products, activeTab]);

  const displayProducts = products.filter(p => p.status === 'tersedia');


  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleInquiryBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg('Mohon isi nomor pelanggan / nomor kartu.');
      return;
    }

    setQuerying(true);
    setBillDetails(null);
    setErrorMsg(null);

    let customerName = 'GURKY ADIPATI RATU';
    let billAmount = 145000;
    // For postpaid products, price is usually just the admin fee, or 0.
    // If we have selectedProduct, we can extract admin fee from it
    let adminFee = selectedProduct ? selectedProduct.price : 2500;
    let fine = 0;

    switch (activeTab) {
      case 'pdam':
        customerName = 'GURKY ADIPATI (PAM JAYA)';
        billAmount = 87500;
        break;
      case 'bpjs':
        customerName = 'KELUARGA GURKY ADIPATI (4 Anggota)';
        billAmount = 150000; // Rp 150.000 (4 x Kelas 2 BPJS)
        break;
      case 'internet':
        customerName = 'GURKY NETWORKS (Broadband)';
        billAmount = 375000;
        break;
      case 'pln_pasca':
        customerName = 'RUMAH UTAMA GURKY (PLN Pascabayar 2200VA)';
        billAmount = 645000;
        fine = 10000; // late fee simulation
        break;
    }

    setBillDetails({
      customerName,
      month: 'Juli 2026',
      billAmount,
      adminFee,
      fine,
      totalAmount: billAmount + adminFee + fine
    });

    setQuerying(false);
  };

  const handlePayBill = async () => {
    if (!billDetails) return;
    if (!wallet || wallet.balance < billDetails.totalAmount) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk melunasi tagihan ini.');
      return;
    }

    let billName = 'Tagihan';
    let serviceLabel = 'Tagihan PPOB';
    switch (activeTab) {
      case 'pdam': 
        billName = 'PDAM / Air'; 
        serviceLabel = 'PDAM / Air';
        break;
      case 'bpjs': 
        billName = 'BPJS Kesehatan'; 
        serviceLabel = 'BPJS Kesehatan';
        break;
      case 'internet': 
        billName = `Internet Pascabayar`; 
        serviceLabel = 'Internet Pascabayar';
        break;
      case 'pln_pasca': 
        billName = 'Listrik Pascabayar'; 
        serviceLabel = 'Listrik Pascabayar';
        break;
    }

    setCheckoutData({
      serviceName: serviceLabel,
      productName: selectedProduct?.name || billName,
      targetNo: customerId,
      amount: billDetails.billAmount,
      adminFee: billDetails.adminFee,
      skuCode: selectedProduct?.code,
      customDetails: {
        'Nama Pelanggan': billDetails.customerName,
        'Periode Tagihan': billDetails.month,
        'Denda / Keterlambatan': formatIDR(billDetails.fine)
      }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl" id="tagihan-page-root">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Pembayaran Tagihan Bulanan</h2>
          <p className="text-sm text-gray-500">Bayar tagihan air PDAM, iuran BPJS, internet kabel, dan listrik pascabayar dalam satu genggaman.</p>
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
              <h5 className="font-bold text-emerald-900 text-sm">Tagihan Sukses Dilunasi!</h5>
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
              <h5 className="font-bold text-red-900 text-sm">Pembayaran Gagal</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500 hover:text-red-800">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Services grid & Input Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick billing service categories list */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
            <button
              onClick={() => {
                setActiveTab('pdam');
                setBillDetails(null);
                setCustomerId('');
              }}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 border font-bold text-xs transition-all ${
                activeTab === 'pdam' 
                  ? 'bg-primary-50 border-primary-500 text-primary-600' 
                  : 'bg-gray-50/50 border-transparent text-gray-500 hover:border-gray-200'
              }`}
            >
              <Droplet className="w-6 h-6 text-blue-500" />
              <span>PDAM / Air</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('bpjs');
                setBillDetails(null);
                setCustomerId('');
              }}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 border font-bold text-xs transition-all ${
                activeTab === 'bpjs' 
                  ? 'bg-primary-50 border-primary-500 text-primary-600' 
                  : 'bg-gray-50/50 border-transparent text-gray-500 hover:border-gray-200'
              }`}
            >
              <Heart className="w-6 h-6 text-red-500" />
              <span>BPJS Kesehatan</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('internet');
                setBillDetails(null);
                setCustomerId('');
              }}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 border font-bold text-xs transition-all ${
                activeTab === 'internet' 
                  ? 'bg-primary-50 border-primary-500 text-primary-600' 
                  : 'bg-gray-50/50 border-transparent text-gray-500 hover:border-gray-200'
              }`}
            >
              <Globe className="w-6 h-6 text-teal-500" />
              <span>Internet Pascabayar</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('pln_pasca');
                setBillDetails(null);
                setCustomerId('');
              }}
              className={`p-4 rounded-2xl flex flex-col items-center gap-2 border font-bold text-xs transition-all ${
                activeTab === 'pln_pasca' 
                  ? 'bg-primary-50 border-primary-500 text-primary-600' 
                  : 'bg-gray-50/50 border-transparent text-gray-500 hover:border-gray-200'
              }`}
            >
              <Zap className="w-6 h-6 text-amber-500" />
              <span>Listrik Pascabayar</span>
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
            <form onSubmit={handleInquiryBill} className="space-y-6">
              <div className="border-b border-gray-50 pb-3">
                <h4 className="font-extrabold text-gray-900 text-base uppercase">
                  {activeTab === 'pdam' && 'Form Cek Tagihan Air PDAM'}
                  {activeTab === 'bpjs' && 'Form Iuran JKN BPJS Kesehatan'}
                  {activeTab === 'internet' && 'Form Tagihan Internet Pascabayar'}
                  {activeTab === 'pln_pasca' && 'Form Tagihan Listrik PLN Pascabayar'}
                </h4>
                <p className="text-xs text-gray-500 mt-1">Sistem akan menarik data tunggakan billing terbaru dari server pusat rekanan.</p>
              </div>

              {/* Dynamic Product Dropdown (PDAM / Internet / BPJS) */}
              {(activeTab === 'pdam' || activeTab === 'internet' || activeTab === 'bpjs' || activeTab === 'pln_pasca') && displayProducts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Pilih Layanan</label>
                  <select 
                    value={selectedProduct?.id || ''}
                    onChange={(e) => {
                      const prod = displayProducts.find(p => p.id === e.target.value);
                      if (prod) setSelectedProduct(prod);
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                  >
                    {displayProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {productsLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Memuat penyedia layanan...</span>
                </div>
              )}

              {/* Customer ID input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  {activeTab === 'pdam' && 'Nomor Sambungan / ID Pelanggan'}
                  {activeTab === 'bpjs' && 'Nomor BPJS Kesehatan / No. Virtual Account'}
                  {activeTab === 'internet' && 'ID Pelanggan Internet'}
                  {activeTab === 'pln_pasca' && 'ID Pelanggan PLN Listrik'}
                </label>
                <div className="relative">
                  <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Contoh: 1402839481"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={querying}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
              >
                {querying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mencari Invoice Tagihan...</span>
                  </>
                ) : (
                  <>
                    <span>Cek Tagihan Sekarang</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Inquiry Results & Checkout */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6 flex flex-col justify-between h-fit">
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <h4 className="font-extrabold text-gray-900 text-base">Detail Tagihan</h4>
              <p className="text-xs text-gray-500 mt-1">Rincian nama, denda, dan biaya penanganan administrasi tagihan Anda.</p>
            </div>

            {billDetails ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl flex items-center gap-2.5">
                  <User className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-emerald-950 truncate">{billDetails.customerName}</span>
                </div>

                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>ID Pelanggan</span>
                  <span className="text-gray-900">{customerId || '-'}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Periode Tagihan</span>
                  <span className="text-gray-900">{billDetails.month}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Iuran Pokok</span>
                  <span className="text-gray-900">{formatIDR(billDetails.billAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Biaya Admin</span>
                  <span className="text-gray-900">{formatIDR(billDetails.adminFee)}</span>
                </div>
                {billDetails.fine > 0 && (
                  <div className="flex justify-between text-xs font-bold text-red-500">
                    <span>Denda Keterlambatan</span>
                    <span>{formatIDR(billDetails.fine)}</span>
                  </div>
                )}

                <div className="border-t border-dashed border-gray-100 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-900">Total Pelunasan</span>
                  <span className="text-xl font-black text-primary-600">{formatIDR(billDetails.totalAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 space-y-1.5">
                <p className="text-xs font-medium">Lengkapi input form di kiri dan lakukan cek tagihan terlebih dahulu.</p>
              </div>
            )}
          </div>

          <button
            disabled={submitting || !billDetails}
            onClick={handlePayBill}
            className={`w-full mt-6 py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white transition-all flex items-center justify-center gap-2 ${
              submitting 
                ? 'bg-primary-400 cursor-not-allowed' 
                : billDetails 
                ? 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/10' 
                : 'bg-gray-200 cursor-not-allowed text-gray-400'
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sedang Melunasi...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Lunasi Tagihan</span>
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
            setCustomerId('');
            setBillDetails(null);
            setCheckoutData(null);
          }}
        />
      )}

    </div>
  );
};
