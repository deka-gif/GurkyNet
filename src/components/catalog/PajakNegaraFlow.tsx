import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { CheckoutSummary, CheckoutData } from '../CheckoutSummary';
import { consumePendingCheckout } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import {
  PajakRegionCity,
  PajakRegionProvince,
  TagihanInquiryResult,
  tagihanService,
} from '../../services/tagihan/tagihan.service';
import {
  composePbbCustomerNo,
  composeSamsatCustomerNo,
  taxYearOptions,
} from '../../utils/pajakCustomerNo';

export type PajakNegaraFlowProps = {
  category: 'pbb' | 'samsat';
  title: string;
  subtitle: string;
  returnPath: string;
};

/**
 * PBB / SAMSAT: Provinsi → Kabupaten (from live catalog) → form → Digiflazz inq-pasca → PIN.
 */
export function PajakNegaraFlow({ category, title, subtitle, returnPath }: PajakNegaraFlowProps) {
  const { wallet, fetchWallet } = useWalletStore();

  const [provinces, setProvinces] = useState<PajakRegionProvince[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [provinceName, setProvinceName] = useState('');
  const [citySku, setCitySku] = useState('');
  const [nop, setNop] = useState('');
  const [tahunPajak, setTahunPajak] = useState<number>(new Date().getFullYear());
  const [nopol, setNopol] = useState('');
  const [rangka, setRangka] = useState('');
  const [ktp, setKtp] = useState('');
  const [inquiring, setInquiring] = useState(false);
  const [inquiry, setInquiry] = useState<TagihanInquiryResult | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [resumePin, setResumePin] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const years = useMemo(() => taxYearOptions(6), []);

  useEffect(() => {
    fetchWallet();
    const pending = consumePendingCheckout(returnPath);
    if (pending?.data) {
      setCheckoutData(pending.data);
      setResumePin(!!pending.resumePin);
    }
  }, [fetchWallet, returnPath]);

  useEffect(() => {
    let cancelled = false;
    setRegionsLoading(true);
    setProvinceName('');
    setCitySku('');
    void tagihanService
      .pajakRegions(category)
      .then((res) => {
        if (cancelled) return;
        setProvinces(res.data?.provinces || []);
      })
      .catch(() => {
        if (!cancelled) setProvinces([]);
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const cities: PajakRegionCity[] = useMemo(() => {
    const p = provinces.find((x) => x.name === provinceName);
    return p?.cities || [];
  }, [provinces, provinceName]);

  const selectedCity = useMemo(
    () => cities.find((c) => c.sku_code === citySku) || null,
    [cities, citySku]
  );

  const regionReady = !!provinceName && !!selectedCity;

  const formReady = useMemo(() => {
    if (!regionReady) return false;
    if (category === 'pbb') {
      const digits = nop.replace(/\D/g, '');
      return digits.length >= 15 && digits.length <= 18 && !!tahunPajak;
    }
    const plate = nopol.replace(/\s+/g, '');
    const frame = rangka.replace(/\s+/g, '');
    const id = ktp.replace(/\D/g, '');
    return plate.length >= 3 && frame.length >= 5 && id.length >= 16;
  }, [regionReady, category, nop, tahunPajak, nopol, rangka, ktp]);

  const handleCekPajak = async () => {
    setErrorMsg(null);
    if (!selectedCity) {
      setErrorMsg('Pilih Provinsi dan Kabupaten/Kota terlebih dahulu.');
      return;
    }
    if (!formReady) {
      setErrorMsg(
        category === 'pbb'
          ? 'Lengkapi NOP dan Tahun Pajak.'
          : 'Lengkapi Nomor Polisi, Nomor Rangka, dan Nomor KTP.'
      );
      return;
    }

    const customerNo =
      category === 'pbb'
        ? composePbbCustomerNo(nop)
        : composeSamsatCustomerNo(nopol, rangka, ktp);

    setInquiring(true);
    try {
      const res = await tagihanService.inquire(
        selectedCity.sku_code,
        customerNo,
        category === 'pbb' ? tahunPajak : null
      );
      if (!res.success || !res.data) {
        setInquiry(null);
        setErrorMsg(res.message || 'Gagal cek pajak. Silakan coba lagi.');
        return;
      }
      setInquiry(res.data);
    } catch (err: any) {
      setInquiry(null);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.inquiry?.[0] ||
        err?.message ||
        'Gagal cek pajak. Silakan coba lagi.';
      setErrorMsg(String(msg));
    } finally {
      setInquiring(false);
    }
  };

  const handleBayar = () => {
    if (!inquiry || !selectedCity) return;
    if (!wallet || wallet.balance < inquiry.selling_price) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi untuk pembayaran pajak ini.');
      setInquiry(null);
      return;
    }

    const tax = inquiry.tax_details || {};
    const objectId =
      category === 'pbb'
        ? tax.nop || inquiry.customer_no
        : tax.nomor_polisi || nopol.toUpperCase();

    setCheckoutData({
      serviceName: title,
      productName: inquiry.product_name || selectedCity.product_name,
      targetNo: inquiry.customer_no,
      amount: inquiry.bill_amount,
      adminFee: inquiry.admin_fee,
      skuCode: inquiry.sku_code,
      inquiryRefId: inquiry.inquiry_ref_id,
      customDetails: {
        'Nama Pemilik': inquiry.customer_name,
        ...(category === 'pbb'
          ? { 'Nomor Objek Pajak': objectId, 'Tahun Pajak': tax.tahun_pajak || String(tahunPajak) }
          : {
              'Nomor Polisi': objectId,
              ...(tax.vehicle_label ? { 'Merek / Model': tax.vehicle_label } : {}),
              ...(tax.tahun_warna ? { 'Tahun / Warna': tax.tahun_warna } : {}),
            }),
        ...(inquiry.denda != null ? { Denda: formatIDR(inquiry.denda) } : {}),
        Provinsi: provinceName,
        'Kabupaten / Kota': selectedCity.name,
      },
    });
    setInquiry(null);
  };

  const tax = inquiry?.tax_details || {};
  const popupTitle =
    category === 'samsat' ? 'Informasi Pajak Kendaraan' : 'Informasi Pajak Bumi & Bangunan';

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-3xl">
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
              <h5 className="font-bold text-emerald-900 text-sm">Pembayaran Berhasil</h5>
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

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-5">
        {regionsLoading ? (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
            <p className="text-xs text-gray-400 font-bold">Memuat wilayah dari katalog provider...</p>
          </div>
        ) : provinces.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-gray-200 rounded-2xl">
            <p className="text-sm font-extrabold text-gray-700">Wilayah belum tersedia</p>
            <p className="text-xs text-gray-400 mt-1">
              Sinkronkan produk {title} Digiflazz di Operations agar dropdown wilayah terisi.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Provinsi</label>
                <select
                  value={provinceName}
                  onChange={(e) => {
                    setProvinceName(e.target.value);
                    setCitySku('');
                    setInquiry(null);
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Pilih Provinsi</option>
                  {provinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Kabupaten / Kota</label>
                <select
                  value={citySku}
                  disabled={!provinceName}
                  onChange={(e) => {
                    setCitySku(e.target.value);
                    setInquiry(null);
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <option value="">{provinceName ? 'Pilih Kabupaten / Kota' : 'Pilih Provinsi dulu'}</option>
                  {cities.map((c) => (
                    <option key={c.sku_code} value={c.sku_code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {regionReady && category === 'pbb' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">Nomor Objek Pajak (NOP)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nop}
                    onChange={(e) => setNop(e.target.value.replace(/\D/g, '').slice(0, 18))}
                    placeholder="18 digit NOP"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Tahun Pajak</label>
                  <select
                    value={tahunPajak}
                    onChange={(e) => setTahunPajak(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {regionReady && category === 'samsat' && (
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Nomor Polisi</label>
                  <input
                    type="text"
                    value={nopol}
                    onChange={(e) => setNopol(e.target.value.toUpperCase().slice(0, 16))}
                    placeholder="Contoh: B 1234 ABC"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Nomor Rangka</label>
                  <input
                    type="text"
                    value={rangka}
                    onChange={(e) => setRangka(e.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 32))}
                    placeholder="Nomor rangka kendaraan"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Nomor KTP Pemilik</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ktp}
                    onChange={(e) => setKtp(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    placeholder="16 digit NIK"
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!formReady || inquiring}
              onClick={() => void handleCekPajak()}
              className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-extrabold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              {inquiring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mengecek pajak...
                </>
              ) : (
                'CEK PAJAK NEGARA'
              )}
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {inquiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">{popupTitle}</p>
                  <h3 className="text-base font-extrabold text-gray-900 mt-1">
                    {(selectedCity?.name || inquiry.provider_name || title).toUpperCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInquiry(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 text-sm">
                <Row label="Nama Pemilik" value={inquiry.customer_name} emphasize />
                {category === 'pbb' ? (
                  <>
                    <Row label="Nomor Objek Pajak" value={tax.nop || inquiry.customer_no} />
                    <Row label="Tahun Pajak" value={tax.tahun_pajak || inquiry.periode || String(tahunPajak)} />
                    {tax.alamat ? <Row label="Alamat" value={tax.alamat} /> : null}
                  </>
                ) : (
                  <>
                    <Row
                      label="Merek / Model"
                      value={
                        tax.vehicle_label
                          ? `${tax.vehicle_label}${tax.nomor_polisi ? ` (${tax.nomor_polisi})` : nopol ? ` (${nopol})` : ''}`
                          : tax.nomor_polisi || nopol || '-'
                      }
                    />
                    {tax.tahun_warna ? <Row label="Tahun / Warna" value={tax.tahun_warna} /> : null}
                    {tax.tahun_buatan && !tax.tahun_warna ? (
                      <Row label="Tahun Buatan" value={tax.tahun_buatan} />
                    ) : null}
                  </>
                )}
                <Row label="Nominal Pajak" value={formatIDR(inquiry.bill_amount)} />
                <Row label="Denda" value={formatIDR(inquiry.denda || 0)} />
                <Row label="Biaya Admin" value={formatIDR(inquiry.admin_fee)} />
              </div>

              <div className="mx-5 border-t border-dashed border-gray-200" />
              <div className="px-5 py-4">
                <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Total Bayar</p>
                <p className="text-xl font-black text-primary-700 mt-0.5">{formatIDR(inquiry.selling_price)}</p>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInquiry(null)}
                  className="py-3 rounded-2xl border border-gray-200 font-extrabold text-sm text-gray-700 hover:bg-gray-50"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  onClick={handleBayar}
                  className="py-3 rounded-2xl bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700"
                >
                  BAYAR PAJAK
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
                `Pembayaran ${title} ${trx?.invoice_number || ''} diproses. Struk digital tersedia di hasil transaksi.`
              );
              setNop('');
              setNopol('');
              setRangka('');
              setKtp('');
              setCitySku('');
              setProvinceName('');
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
