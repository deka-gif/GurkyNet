import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { savePendingCheckout, buildCreatePinUrl } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { getOrCreateIdempotencyKeyForLogicalAction, clearIdempotencyKeyForLogicalAction } from '../../utils/idempotency';
import type { Product } from '../../types';
import type { ScannedSerial } from '../../utils/voucherPhysicalScan';
import {
  voucherPhysicalBatchService,
  type VoucherPhysicalBatch,
  type VoucherPhysicalBatchItem,
} from '../../services/voucherPhysicalBatch/voucherPhysicalBatch.service';

export type BatchCheckoutStep = 'SUMMARY' | 'PIN' | 'LOADING' | 'RESULT';

export const ITEM_STATUS_LABEL: Record<string, string> = {
  queued: 'Menunggu',
  processing: 'Diproses',
  success: 'Berhasil',
  failed: 'Gagal',
  refunded: 'Gagal',
};

export const ITEM_STATUS_CLASS: Record<string, string> = {
  queued: 'text-gray-400',
  processing: 'text-amber-600',
  success: 'text-emerald-600',
  failed: 'text-red-600',
  refunded: 'text-red-600',
};

export const PHYSICAL_BATCH_LOGICAL_ID = 'voucher-internet-physical-batch';

export type PhysicalBatchCheckoutProps = {
  product: Product;
  serials: ScannedSerial[];
  onClose: () => void;
  onSettled: () => void;
};

/**
 * Dedicated (not shared) PIN → submit → poll flow for a Voucher Fisik batch. Not built
 * on top of <CheckoutSummary/> because that component posts to POST /transactions —
 * a single-SKU/single-target shape this batch (POST /voucher-internet/physical-batches,
 * N serials) does not fit. Every other PPOB page keeps using CheckoutSummary unchanged.
 */
export function PhysicalBatchCheckout({
  product,
  serials,
  onClose,
  onSettled,
}: PhysicalBatchCheckoutProps) {
  const { user } = useAuth();
  const { flags: featureFlags } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<BatchCheckoutStep>('SUMMARY');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batch, setBatch] = useState<VoucherPhysicalBatch | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = product.price * serials.length;
  const isTerminal = batch ? batch.status === 'completed' || batch.status === 'completed_with_failures' : false;

  useEffect(() => {
    if (!batch || isTerminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await voucherPhysicalBatchService.getById(batch.id);
        if (res?.data) setBatch(res.data);
      } catch {
        // transient poll failure — next tick retries; the batch itself is unaffected.
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batch?.id, batch?.status, isTerminal]);

  useEffect(() => {
    if (isTerminal) {
      clearIdempotencyKeyForLogicalAction(PHYSICAL_BATCH_LOGICAL_ID);
    }
  }, [isTerminal]);

  const goToPin = () => {
    if (!user?.hasPin) {
      // Scan list already persisted via savePendingScan (continuous), so returning here
      // after Create PIN naturally restores progress; only the PIN modal itself is lost.
      savePendingCheckout(
        {
          serviceName: 'Voucher Internet',
          productName: product.name,
          targetNo: 'BATCH',
          amount: total,
          adminFee: 0,
          skuCode: product.code,
        },
        location.pathname
      );
      navigate(buildCreatePinUrl(location.pathname));
      return;
    }
    setStep('PIN');
  };

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setPinError(null);
    if (cleaned.length === 6 && !submittingRef.current) {
      submittingRef.current = true;
      setStep('LOADING');
      void submit(cleaned);
    }
  };

  const submit = async (enteredPin: string) => {
    setSubmitError(null);
    try {
      const idempotencyKey = getOrCreateIdempotencyKeyForLogicalAction(PHYSICAL_BATCH_LOGICAL_ID);
      const res = await voucherPhysicalBatchService.create({
        sku_code: product.code,
        serials: serials.map((s) => ({ serial_number: s.serial, scanned_at: s.scannedAt })),
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });
      submittingRef.current = false;
      if (res?.data) {
        setBatch(res.data);
        setStep('RESULT');
      } else {
        setSubmitError('Gagal membuat batch voucher fisik.');
        setStep('SUMMARY');
      }
    } catch (err: any) {
      submittingRef.current = false;
      const message: string =
        err?.response?.data?.message || err?.message || 'Gagal memproses batch voucher fisik.';
      if (/pin/i.test(message)) {
        setPin('');
        setPinError(message);
        setStep('PIN');
      } else {
        setSubmitError(message);
        setStep('SUMMARY');
      }
    }
  };

  const handleRetryItem = async (item: VoucherPhysicalBatchItem) => {
    if (!batch) return;
    setRetryingId(item.id);
    try {
      await voucherPhysicalBatchService.retryItem(batch.id, item.id);
      const res = await voucherPhysicalBatchService.getById(batch.id);
      if (res?.data) setBatch(res.data);
    } catch {
      // surfaced implicitly — item stays 'failed' and Retry remains available
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-gray-900">Aktivasi Voucher Fisik</h3>
          {step !== 'LOADING' && (
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {step === 'SUMMARY' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Produk</span>
                <span className="font-extrabold text-gray-900">{product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jumlah</span>
                <span className="font-extrabold text-gray-900">{serials.length} SN</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-dashed border-gray-200">
                <span className="text-gray-700 font-bold">Total Bayar</span>
                <span className="font-black text-primary-700">{formatIDR(total)}</span>
              </div>
            </div>
            {submitError && <p className="text-xs text-red-600 font-semibold">{submitError}</p>}
            {!featureFlags.purchase_enabled && (
              <p className="text-xs text-amber-600 font-semibold">{featureFlags.messages.purchase}</p>
            )}
            <button
              type="button"
              onClick={goToPin}
              disabled={!featureFlags.purchase_enabled}
              className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm"
            >
              Bayar Sekarang
            </button>
          </div>
        )}

        {step === 'PIN' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 text-center">Masukkan PIN transaksi 6 digit</p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              maxLength={6}
              className="w-full text-center tracking-[0.6em] text-2xl font-black py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••"
            />
            {pinError && <p className="text-xs text-red-600 font-semibold text-center">{pinError}</p>}
          </div>
        )}

        {step === 'LOADING' && (
          <div className="py-10 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary-500" />
            <p className="text-xs text-gray-500">Memproses pembayaran batch...</p>
          </div>
        )}

        {step === 'RESULT' && batch && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-black text-emerald-600 text-lg">{batch.successCount}</div>
                <div className="text-gray-500">Berhasil</div>
              </div>
              <div>
                <div className="font-black text-red-600 text-lg">{batch.failedCount}</div>
                <div className="text-gray-500">Gagal</div>
              </div>
              <div>
                <div className="font-black text-gray-900 text-lg">{batch.totalSerials}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
            {!isTerminal && (
              <p className="text-[11px] text-amber-600 font-semibold text-center">
                Memproses aktivasi... status akan diperbarui otomatis.
              </p>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {(batch.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                >
                  <span className="font-mono font-bold text-gray-800 truncate mr-2">{item.serialNumber}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-black uppercase text-[10px] ${ITEM_STATUS_CLASS[item.status] || 'text-gray-400'}`}>
                      {ITEM_STATUS_LABEL[item.status] || item.status}
                    </span>
                    {item.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item)}
                        disabled={retryingId === item.id}
                        className="text-[10px] font-bold text-primary-600 underline disabled:opacity-50"
                      >
                        {retryingId === item.id ? '...' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isTerminal && (
              <button
                type="button"
                onClick={onSettled}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm"
              >
                Selesai
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
