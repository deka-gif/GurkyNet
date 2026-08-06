import React, { useState } from 'react';
import { Copy, Check, QrCode, Building2, Store, X } from 'lucide-react';
import { formatIDR } from '../../utils/currency';

export type PaymentPlaceholderKind = 'qris' | 'va' | 'retail' | 'alfamart' | 'indomaret';

const VA_BANKS = ['BCA', 'BNI', 'BRI', 'Mandiri', 'Permata', 'CIMB'] as const;

interface PaymentPlaceholderModalProps {
  open: boolean;
  kind: PaymentPlaceholderKind | null;
  amount: number;
  onClose: () => void;
}

export const PaymentPlaceholderModal: React.FC<PaymentPlaceholderModalProps> = ({
  open,
  kind,
  amount,
  onClose,
}) => {
  const [vaStep, setVaStep] = useState<'pick' | 'detail'>('pick');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [retailOutlet, setRetailOutlet] = useState<'alfamart' | 'indomaret' | null>(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setVaStep('pick');
      setSelectedBank(null);
      setRetailOutlet(null);
      setCopied(false);
      return;
    }
    if (kind === 'alfamart' || kind === 'indomaret') {
      setRetailOutlet(kind);
    }
  }, [open, kind]);

  if (!open || !kind) return null;

  const placeholderCode = '****************';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(placeholderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const title =
    kind === 'qris'
      ? 'QRIS GurkyPay'
      : kind === 'va'
        ? 'Virtual Account'
        : kind === 'retail'
          ? 'Alfa / Indomaret'
          : 'Kode Pembayaran';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            {kind === 'qris' && <QrCode className="w-5 h-5 text-primary-600" />}
            {kind === 'va' && <Building2 className="w-5 h-5 text-primary-600" />}
            {(kind === 'retail' || kind === 'alfamart' || kind === 'indomaret') && (
              <Store className="w-5 h-5 text-primary-600" />
            )}
            <h3 className="font-extrabold text-gray-900 text-sm">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Nominal</span>
            <span className="font-extrabold text-gray-900">{formatIDR(amount)}</span>
          </div>

          {kind === 'qris' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Pembayaran QRIS akan tersedia setelah Midtrans diaktifkan.
              </p>
              <div className="mx-auto w-48 h-48 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2">
                <QrCode className="w-12 h-12 text-gray-300" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Placeholder QR
                </span>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Status</p>
                <p className="text-xs font-semibold text-amber-900 mt-0.5">
                  Menunggu konfigurasi pembayaran.
                </p>
              </div>
            </div>
          )}

          {kind === 'va' && vaStep === 'pick' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-700">Pilih Bank</p>
              <div className="grid grid-cols-2 gap-2">
                {VA_BANKS.map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => {
                      setSelectedBank(bank);
                      setVaStep('detail');
                    }}
                    className="py-3 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/30 text-xs font-extrabold text-gray-800 transition-all"
                  >
                    {bank}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'va' && vaStep === 'detail' && selectedBank && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Bank</span>
                <span className="font-extrabold text-gray-900">{selectedBank}</span>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-4 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Nomor Virtual Account
                </p>
                <p className="text-lg font-black tracking-widest text-gray-900">{placeholderCode}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Status</p>
                <p className="text-xs font-semibold text-amber-900 mt-0.5">
                  Menunggu konfigurasi Midtrans
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="w-full py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Disalin' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVaStep('pick');
                  setSelectedBank(null);
                }}
                className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                Ganti bank
              </button>
            </div>
          )}

          {(kind === 'retail' || kind === 'alfamart' || kind === 'indomaret') && (
            <div className="space-y-4">
              {(kind === 'retail' && !retailOutlet) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRetailOutlet('alfamart')}
                    className="py-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-extrabold hover:border-primary-400"
                  >
                    Alfamart
                  </button>
                  <button
                    type="button"
                    onClick={() => setRetailOutlet('indomaret')}
                    className="py-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-extrabold hover:border-primary-400"
                  >
                    Indomaret
                  </button>
                </div>
              )}
              {retailOutlet && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Outlet</span>
                    <span className="font-extrabold text-gray-900 capitalize">{retailOutlet}</span>
                  </div>
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-4 space-y-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      Kode Pembayaran
                    </p>
                    <p className="text-lg font-black tracking-widest text-gray-900">{placeholderCode}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Status</p>
                    <p className="text-xs font-semibold text-amber-900 mt-0.5">
                      Menunggu konfigurasi Midtrans
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Disalin' : 'Copy'}</span>
                  </button>
                  {kind === 'retail' && (
                    <button
                      type="button"
                      onClick={() => setRetailOutlet(null)}
                      className="w-full text-xs font-semibold text-gray-500 hover:text-gray-800"
                    >
                      Ganti outlet
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
