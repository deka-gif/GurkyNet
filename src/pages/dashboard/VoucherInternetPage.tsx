import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Printer,
  RefreshCw,
  Smartphone,
  Store,
  Wifi,
  Zap,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useProductStore } from '../../store/product.store';
import { CheckoutSummary, CheckoutData } from '../../components/CheckoutSummary';
import { Product } from '../../types';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';

type Mode = 'tembak' | 'elektronik' | 'fisik';

type BulkJob = {
  sn: string;
  status: 'queued' | 'processing' | 'success' | 'failed';
  message?: string;
  invoice?: string;
};

const detectOperator = (phone: string): string | null => {
  const cleanNo = phone.replace(/\D/g, '');
  if (cleanNo.length < 4) return null;
  const prefix = cleanNo.slice(0, 4);
  if (['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0823'].includes(prefix)) return 'Telkomsel';
  if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(prefix)) return 'Indosat Ooredoo';
  if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(prefix)) return 'XL Axiata';
  if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) return 'Tri (3)';
  if (['0831', '0832', '0833', '0838'].includes(prefix)) return 'Axis';
  if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(prefix)) return 'Smartfren';
  return 'Operator Lain';
};

const expandSnRange = (input: string): string[] => {
  const raw = input.trim();
  if (!raw) return [];
  // Support: SN1,SN2 or SN1-SN2 (numeric suffix range) or newline list
  if (raw.includes(',') || raw.includes('\n')) {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const rangeMatch = raw.match(/^(.+?)(\d+)\s*[-–]\s*(.+?)(\d+)$/);
  if (rangeMatch) {
    const prefixA = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const prefixB = rangeMatch[3];
    const end = parseInt(rangeMatch[4], 10);
    if (prefixA === prefixB && Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 200) {
      const width = rangeMatch[2].length;
      const out: string[] = [];
      for (let i = start; i <= end; i++) {
        out.push(`${prefixA}${String(i).padStart(width, '0')}`);
      }
      return out;
    }
  }
  return [raw];
};

export const VoucherInternetPage = () => {
  const { wallet, fetchWallet } = useWalletStore();
  const { products, loading: productsLoading, fetchProducts } = useProductStore();

  const [mode, setMode] = useState<Mode>('tembak');
  const [zona, setZona] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState('');
  const [autoProvider, setAutoProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [snInput, setSnInput] = useState('');
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([]);
  const [bulkRunning] = useState(false);

  useEffect(() => {
    fetchWallet();
    // Prefer dedicated voucher-internet family; also load data as fallback katalog kuota.
    fetchProducts({ category: 'voucher-internet' }).then(() => {
      // no-op; store replaces list. If empty UI will say sync needed.
    });
    const pending = consumePendingCheckout('/dashboard/voucher-internet');
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, fetchProducts]);

  useEffect(() => {
    if (mode === 'tembak') {
      setAutoProvider(detectOperator(phoneNo));
    }
  }, [phoneNo, mode]);

  const zonas = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (!isCatalogListed(p)) continue;
      const name = (p.operatorName || 'Umum').trim();
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [products]);

  const zonaProducts = useMemo(() => {
    if (!zona) return [];
    return products
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, zona))
      .sort((a, b) => a.price - b.price);
  }, [products, zona]);

  const tembakProducts = useMemo(() => {
    const provider = autoProvider || zona;
    if (!provider) return [];
    return products
      .filter((p) => isCatalogListed(p) && operatorsMatch(p.operatorName, provider))
      .sort((a, b) => a.price - b.price);
  }, [products, autoProvider, zona]);

  const resetSelection = () => {
    setSelectedProduct(null);
    setVoucherCode(null);
    setBulkJobs([]);
    setErrorMsg(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setZona(null);
    setPhoneNo('');
    setAutoProvider(null);
    setQty(1);
    setSnInput('');
    resetSelection();
  };

  const startCheckout = (opts?: { targetOverride?: string; qtyOverride?: number }) => {
    if (!selectedProduct) {
      setErrorMsg('Pilih produk voucher internet terlebih dahulu.');
      return;
    }
    if (!isProductPurchasable(selectedProduct)) {
      setErrorMsg('Produk sedang maintenance atau tidak tersedia untuk dibeli.');
      return;
    }
    const target =
      opts?.targetOverride ||
      (mode === 'tembak' ? phoneNo : mode === 'elektronik' ? phoneNo || wallet?.walletNo || 'EVOUCHER' : snInput.trim());

    if (mode === 'tembak' && phoneNo.replace(/\D/g, '').length < 10) {
      setErrorMsg('Nomor HP penerima tidak valid.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price * (opts?.qtyOverride || qty || 1)) {
      setErrorMsg('Saldo GurkyPay tidak mencukupi.');
      return;
    }

    setCheckoutData({
      serviceName: 'Voucher Internet',
      productName: selectedProduct.name,
      targetNo: String(target),
      amount: selectedProduct.price * (opts?.qtyOverride || 1),
      adminFee: 0,
      skuCode: selectedProduct.code,
      customDetails: {
        Mode: mode,
        Zona: zona || autoProvider || '-',
        Qty: String(opts?.qtyOverride || qty || 1),
      },
    });
  };

  const runBulkActivation = async () => {
    if (!selectedProduct) {
      setErrorMsg('Pilih paket aktivasi terlebih dahulu.');
      return;
    }
    const sns = expandSnRange(snInput);
    if (sns.length === 0) {
      setErrorMsg('Masukkan barcode / serial number / range SN.');
      return;
    }
    if (sns.length > 200) {
      setErrorMsg('Maksimal 200 SN per batch.');
      return;
    }
    if (!wallet || wallet.balance < selectedProduct.price * sns.length) {
      setErrorMsg(`Saldo tidak cukup untuk ${sns.length} aktivasi (${formatIDR(selectedProduct.price * sns.length)}).`);
      return;
    }

    setBulkJobs(sns.map((sn) => ({ sn, status: 'queued' as const })));
    // Checkout first SN with PIN; remaining stay queued for sequential follow-up purchases.
    startCheckout({ targetOverride: sns[0], qtyOverride: 1 });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setSuccessMsg('Kode voucher disalin.');
    } catch {
      setErrorMsg('Gagal menyalin kode.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Voucher Internet</h2>
          <p className="text-sm text-gray-500">
            Tembak langsung, voucher elektronik, atau aktivasi voucher fisik kosongan — alur terpisah sesuai bisnis PPOB.
          </p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2">
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(
          [
            { key: 'tembak' as const, label: 'Tembak Langsung', icon: Zap, desc: 'Kuota aktif ke nomor HP' },
            { key: 'elektronik' as const, label: 'Voucher Elektronik', icon: Wifi, desc: 'Kode voucher bisa copy/print' },
            { key: 'fisik' as const, label: 'Voucher Fisik', icon: Store, desc: 'Scan/SN bulk activation' },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => switchMode(item.key)}
              className={`text-left p-4 rounded-2xl border transition-all ${
                active ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
              <div className="font-extrabold text-gray-900 text-sm mt-2">{item.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 text-xs text-emerald-800 font-semibold">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-600">
              Tutup
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1 text-xs text-red-800 font-semibold">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-red-600">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        {/* Zona */}
        <div className="space-y-2.5">
          <h4 className="font-extrabold text-gray-900 text-sm">1. Pilih Zona / Provider</h4>
          {productsLoading ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-300" />
            </div>
          ) : zonas.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
              Katalog voucher internet kosong. Sinkronkan produk provider (kategori voucher-internet) di Operations.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {zonas.map((z) => (
                <button
                  key={z.name}
                  type="button"
                  onClick={() => {
                    setZona(z.name);
                    resetSelection();
                  }}
                  className={`p-3 rounded-xl border text-left text-xs font-extrabold ${
                    zona === z.name ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {z.name}
                  <div className="text-[10px] font-semibold text-gray-400 mt-0.5">{z.count} produk</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {zona && mode === 'tembak' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">2. Nomor HP</h4>
            <div className="relative">
              <Smartphone className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value.replace(/\D/g, ''))}
                placeholder="08xxxxxxxxxx"
                className="w-full pl-12 pr-28 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {autoProvider && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-100">
                  {autoProvider}
                </span>
              )}
            </div>
            <ProductPicker
              products={tembakProducts.length ? tembakProducts : zonaProducts}
              selected={selectedProduct}
              onSelect={setSelectedProduct}
            />
            <button
              type="button"
              onClick={() => startCheckout()}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
            >
              Lanjut Bayar (PIN)
            </button>
          </div>
        )}

        {zona && mode === 'elektronik' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">2. Produk & Qty</h4>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Nomor HP (opsional untuk pengiriman)</label>
              <input
                type="tel"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value.replace(/\D/g, ''))}
                placeholder="08xxxxxxxxxx"
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Qty</label>
              <input
                type="number"
                min={1}
                max={20}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-32 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <ProductPicker products={zonaProducts} selected={selectedProduct} onSelect={setSelectedProduct} />
            <button
              type="button"
              onClick={() => startCheckout({ qtyOverride: qty })}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
            >
              Bayar & Generate Kode
            </button>
            {voucherCode && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase text-emerald-800">Kode Voucher</p>
                <p className="text-lg font-black tracking-widest text-gray-900 break-all">{voucherCode}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyCode(voucherCode)}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {zona && mode === 'fisik' && (
          <div className="space-y-4">
            <h4 className="font-extrabold text-gray-900 text-sm">2. Scan / Input SN</h4>
            <textarea
              value={snInput}
              onChange={(e) => setSnInput(e.target.value)}
              rows={4}
              placeholder={'Scan barcode atau input SN.\nContoh range: ABC1000-ABC1010\nAtau list: SN1, SN2, SN3'}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-[10px] text-gray-500">
              Provider terdeteksi dari zona: <span className="font-bold text-gray-800">{zona}</span>. Maksimal 200 SN per batch.
            </p>
            <ProductPicker products={zonaProducts} selected={selectedProduct} onSelect={setSelectedProduct} />
            <button
              type="button"
              onClick={runBulkActivation}
              disabled={bulkRunning}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm"
            >
              {bulkRunning ? 'Memproses Queue...' : 'Antrikan Aktivasi Bulk'}
            </button>

            {bulkJobs.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-gray-700">Progress Realtime</h5>
                  <button
                    type="button"
                    onClick={() => setBulkJobs([])}
                    className="text-[10px] font-bold text-gray-400 inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" /> Reset
                  </button>
                </div>
                {bulkJobs.map((job) => (
                  <div
                    key={job.sn}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                  >
                    <span className="font-mono font-bold text-gray-800 truncate mr-2">{job.sn}</span>
                    <span
                      className={`font-black uppercase text-[10px] ${
                        job.status === 'success'
                          ? 'text-emerald-600'
                          : job.status === 'failed'
                            ? 'text-red-600'
                            : job.status === 'processing'
                              ? 'text-amber-600'
                              : 'text-gray-400'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {checkoutData && (
        <CheckoutSummary
          data={checkoutData}
          initialStep={resumePin ? 'PIN' : 'SUMMARY'}
          onClose={() => {
            setCheckoutData(null);
            setResumePin(false);
          }}
          onSuccess={(trx: any) => {
            setCheckoutData(null);
            setResumePin(false);
            fetchWallet();
            const code =
              trx?.notes ||
              trx?.note ||
              trx?.sn ||
              trx?.serial_number ||
              trx?.transactionCode ||
              null;
            if (mode === 'elektronik' && code) {
              setVoucherCode(String(code));
            }
            if (mode === 'fisik' && bulkJobs.length > 0) {
              // Bulk after first success: remaining items need PIN — user must re-confirm.
              // Store pin is not retained by design; mark first done and instruct.
              setBulkJobs((prev) =>
                prev.map((j, idx) =>
                  idx === 0
                    ? {
                        ...j,
                        status: 'success',
                        invoice: trx?.transactionCode || trx?.invoice_number,
                        message: 'OK',
                      }
                    : j
                )
              );
              setSuccessMsg(
                'Item pertama berhasil. Untuk sisa antrian, ulangi konfirmasi PIN per batch atau proses satu per satu demi keamanan.'
              );
            } else {
              setSuccessMsg('Transaksi voucher internet berhasil.');
            }
          }}
        />
      )}
    </div>
  );
};

function ProductPicker({
  products,
  selected,
  onSelect,
}: {
  products: Product[];
  selected: Product | null;
  onSelect: (p: Product) => void;
}) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-bold text-gray-700">Pilih Paket</h5>
      {products.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          Tidak ada produk untuk zona ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={`text-left p-3 rounded-xl border ${
                selected?.id === p.id ? 'border-primary-500 bg-primary-50/40' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="text-xs font-extrabold text-gray-900">{p.name}</div>
              <div className="text-sm font-black text-primary-600 mt-1">{formatIDR(p.price)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
