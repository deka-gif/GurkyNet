import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { tagihanService, TagihanInquiryResult } from '../../services/tagihan/tagihan.service';
import { isCatalogListed } from '../../utils/catalogAvailability';

export type BillPaymentFlowProps = {
  category: string;
  title: string;
  subtitle: string;
  serviceName: string;
  returnPath: string;
  targetLabel?: string;
  targetPlaceholder?: string;
};

type Step = 'vendor' | 'input';

/**
 * Real postpaid bill flow: Vendor → ID pelanggan → Digiflazz inquiry → validate → PIN.
 * Amounts and customer name come only from provider inquiry (never hardcoded).
 */
export function BillPaymentFlow({
  category,
  title,
  subtitle,
  serviceName,
  returnPath,
  targetLabel = 'Nomor / ID Pelanggan',
  targetPlaceholder = 'Masukkan nomor pelanggan',
}: BillPaymentFlowProps) {
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [step, setStep] = useState<Step>('vendor');
  const [vendorQuery, setVendorQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerNo, setCustomerNo] = useState('');
  const [inquiring, setInquiring] = useState(false);
  const [inquiry, setInquiry] = useState<TagihanInquiryResult | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
    fetchProducts({ category });
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts, category, returnPath]);

  const vendors = useMemo(() => {
    const map = new Map<string, { name: string; products: Product[] }>();
    for (const p of products) {
      if (!isCatalogListed(p)) continue;
      const name = (p.operatorName || p.name || 'Lainnya').trim();
      const key = name.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        prev.products.push(p);
      } else {
        map.set(key, { name, products: [p] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [products]);

  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q));
  }, [vendors, vendorQuery]);

  const vendorProducts = useMemo(() => {
    if (!selectedVendor) return [];
    const entry = vendors.find((v) => v.name.toLowerCase() === selectedVendor.toLowerCase());
    return (entry?.products || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [vendors, selectedVendor]);

  const selectVendor = (name: string) => {
    setSelectedVendor(name);
    setErrorMsg(null);
    setInquiry(null);
    const entry = vendors.find((v) => v.name.toLowerCase() === name.toLowerCase());
    const list = entry?.products || [];
    // Single SKU per vendor (typical PDAM city) → skip product picker
    setSelectedProduct(list.length === 1 ? list[0] : null);
    setStep('input');
  };

  // Single-vendor categories (e.g. PDAM): skip redundant vendor picker — land on input form directly.
  useEffect(() => {
    if (productsLoading || vendors.length !== 1 || step !== 'vendor' || selectedVendor) {
      return;
    }
    selectVendor(vendors[0].name);
  }, [productsLoading, vendors, step, selectedVendor]);

  const goBackToVendors = () => {
    setStep('vendor');
    setSelectedVendor(null);
    setSelectedProduct(null);
    setCustomerNo('');
    setInquiry(null);
    setErrorMsg(null);
  };

  const handleCekTagihan = async () => {
    setErrorMsg(null);
    if (!selectedProduct) {
      setErrorMsg('Pilih produk / vendor terlebih dahulu.');
      return;
    }
    const no = customerNo.trim();
    if (!no) {
      setErrorMsg(`${targetLabel} wajib diisi.`);
      return;
    }

    setInquiring(true);
    try {
      const res = await tagihanService.inquire(selectedProduct.code, no);
      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Gagal cek tagihan. Silakan coba lagi.');
        return;
      }
      setInquiry(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.inquiry?.[0] ||
        err?.message ||
        'Gagal cek tagihan. Silakan coba lagi.';
      setErrorMsg(String(msg));
    } finally {
      setInquiring(false);
    }
  };

  const handleCancelInquiry = () => {
    setInquiry(null);
  };

  const handleBayarSekarang = () => {
    if (!inquiry || !selectedProduct) return;

    if (!wallet || wallet.balance < inquiry.selling_price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembayaran ini.');
      setInquiry(null);
      return;
    }

    setCheckoutData({
      serviceName,
      productName: inquiry.product_name || selectedProduct.name,
      targetNo: inquiry.customer_no,
      amount: inquiry.bill_amount,
      adminFee: inquiry.admin_fee,
      skuCode: inquiry.sku_code || selectedProduct.code,
      inquiryRefId: inquiry.inquiry_ref_id,
      customDetails: {
        Vendor: selectedVendor || inquiry.provider_name || '-',
        'Nama Pelanggan': inquiry.customer_name,
        'ID Pelanggan': inquiry.customer_no,
        'Periode Bulan': inquiry.periode || '-',
      },
    });
    setInquiry(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

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
              <h5 className="font-bold text-emerald-900 text-sm">Transaksi Berhasil</h5>
              <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
            </div>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-500">
              Tutup
            </button>
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
              <h5 className="font-bold text-red-900 text-sm">Perhatian</h5>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-500">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'vendor' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">Pilih Vendor / Biller</h4>
              <p className="text-xs text-gray-500 mt-0.5">Pilih layanan dari katalog provider aktif.</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vendorQuery}
                onChange={(e) => setVendorQuery(e.target.value)}
                placeholder="Cari vendor..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {productsLoading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
              <p className="text-xs text-gray-400 font-bold">Memuat katalog dari server...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
              <p className="text-sm font-extrabold text-gray-700">Vendor belum tersedia</p>
              <p className="text-xs text-gray-400 mt-1">
                Katalog kosong. Pastikan sinkronisasi produk pascabayar Digiflazz aktif di Operations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredVendors.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => selectVendor(v.name)}
                  className="text-left p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                >
                  <div className="font-extrabold text-gray-900 text-sm truncate">{v.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                    {v.products.length} produk
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'input' && selectedVendor && (
        <div className="space-y-4">
          {vendors.length > 1 && (
            <button
              type="button"
              onClick={goBackToVendors}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-600"
            >
              <ChevronLeft className="w-4 h-4" />
              Ganti vendor
            </button>
          )}

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">{selectedVendor}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Masukkan ID pelanggan, lalu cek tagihan ke provider (inquiry saja — saldo belum terpotong).
              </p>
            </div>

            {vendorProducts.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">Pilih Produk</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vendorProducts.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p);
                        setInquiry(null);
                      }}
                      className={`text-left p-3 rounded-xl border text-sm font-bold transition-all ${
                        selectedProduct?.code === p.code
                          ? 'border-primary-500 bg-primary-50 text-primary-900'
                          : 'border-gray-100 bg-gray-50 text-gray-800 hover:border-primary-300'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">{targetLabel}</label>
              <input
                type="text"
                value={customerNo}
                onChange={(e) => setCustomerNo(e.target.value.replace(/[^\dA-Za-z]/g, ''))}
                placeholder={targetPlaceholder}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              type="button"
              disabled={inquiring || !selectedProduct || !customerNo.trim()}
              onClick={() => void handleCekTagihan()}
              className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              {inquiring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mengecek tagihan...
                </>
              ) : (
                'CEK TAGIHAN'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Inquiry validation overlay — live provider data only */}
      <AnimatePresence>
        {inquiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-detail-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Detail Tagihan</p>
                  <h3 id="bill-detail-title" className="text-base font-extrabold text-gray-900 mt-1">
                    {(selectedVendor || inquiry.provider_name || inquiry.product_name).toUpperCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancelInquiry}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 text-sm">
                <Row label="Nama Pelanggan" value={inquiry.customer_name} emphasize />
                <Row label="ID Pelanggan" value={inquiry.customer_no} />
                <Row label="Periode Bulan" value={inquiry.periode || '-'} />
                <Row label="Nominal Tagihan" value={formatIDR(inquiry.bill_amount)} />
                <Row label="Biaya Admin" value={formatIDR(inquiry.admin_fee)} />
              </div>

              <div className="mx-5 border-t border-dashed border-gray-200" />

              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Total Bayar</p>
                  <p className="text-xl font-black text-primary-700 mt-0.5">
                    {formatIDR(inquiry.selling_price)}
                  </p>
                </div>
              </div>

              <p className="px-5 pb-3 text-[11px] text-amber-800 bg-amber-50/80 border-y border-amber-100 leading-relaxed">
                Mohon pastikan <span className="font-extrabold">NAMA PELANGGAN</span> sudah sesuai sebelum
                melakukan pembayaran.
              </p>

              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCancelInquiry}
                  className="py-3 rounded-2xl border border-gray-200 font-extrabold text-sm text-gray-700 hover:bg-gray-50"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleBayarSekarang}
                  className="py-3 rounded-2xl bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700"
                >
                  BAYAR SEKARANG
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutData && (
          <CheckoutSummary
            data={checkoutData}
            initialStep={resumePin ? 'PIN' : 'PIN'}
            onClose={() => {
              setCheckoutData(null);
              setResumePin(false);
            }}
            onSuccess={(trx) => {
              setCheckoutData(null);
              setResumePin(false);
              setSuccessMsg(
                `Tagihan ${trx?.invoice_number || ''} diproses. Cek struk digital di riwayat transaksi.`
              );
              setCustomerNo('');
              setSelectedProduct(null);
              setSelectedVendor(null);
              setStep('vendor');
              fetchWallet();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-right text-xs font-extrabold ${
          emphasize ? 'text-gray-950 uppercase tracking-wide' : 'text-gray-900'
        }`}
      >
        {value || '-'}
      </span>
    </div>
  );
}
