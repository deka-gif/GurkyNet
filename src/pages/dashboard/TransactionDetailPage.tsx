import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, MessageCircle } from 'lucide-react';
import { useTransactionStore } from '../../store/transaction.store';
import { transactionService } from '../../services/transaction/transaction.service';
import { walletService } from '../../services/wallet/wallet.service';
import {
  customerFacingTransactionNotes,
  isExpiredStatus,
  isPendingStatus,
  isSuccessStatus,
  isWalletTopUpService,
} from '../../utils/transactionStatus';
import { ensureMidtransSnap } from '../../utils/midtransSnap';
import { customerFacingPaymentMethodLabel } from '../../utils/paymentMethodLabel';
import { resolveReceiptFields } from '../../utils/receiptDeliverable';
import { TransactionReceipt } from '../../components/TransactionReceipt';
import type { PaymentResumeInfo, Transaction } from '../../types';

function normalizeDetailTransaction(row: any): Transaction {
  const paymentResumeRaw = row?.paymentResume || row?.payment_resume || null;
  const paymentResume: PaymentResumeInfo | undefined = paymentResumeRaw
    ? {
        canResume: Boolean(paymentResumeRaw.canResume ?? paymentResumeRaw.can_resume),
        snapToken: paymentResumeRaw.snapToken ?? paymentResumeRaw.snap_token ?? null,
      }
    : undefined;

  const paymentMethodLabel = customerFacingPaymentMethodLabel(
    row?.paymentMethod ?? row?.payment_method,
    row?.paymentMethodLabel ?? row?.payment_method_label
  );

  return {
    ...row,
    id: row?.id,
    transactionCode: row?.transactionCode || row?.invoice_number || row?.transaction_code || '',
    invoice_number: row?.invoice_number || row?.transactionCode || row?.transaction_code,
    serviceName: row?.serviceName || row?.service_name || '',
    productName: row?.productName || row?.product_name || row?.serviceName || row?.service_name || '',
    targetNo: row?.targetNo || row?.target_number || '',
    amount: Number(row?.amount ?? 0),
    date: row?.date || row?.createdAt || row?.created_at || '',
    status: row?.status,
    statusRaw: row?.statusRaw || row?.status_raw || row?.status,
    notes: row?.notes || row?.note || '',
    note: row?.note || row?.notes || '',
    paymentMethod: paymentMethodLabel,
    paymentMethodLabel,
    totalPayment: row?.totalPayment != null ? Number(row.totalPayment) : undefined,
    adminFee: row?.adminFee != null ? Number(row.adminFee) : undefined,
    paymentResume,
  };
}

/**
 * Transaction detail page — uses cached store + optional GET /transactions/:id.
 * FR-TOPUP-UX-01 — Top Up Midtrans resume via stored snap_token (no new order).
 */
export function TransactionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { transactions, fetchTransactions } = useTransactionStore();
  const [remote, setRemote] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(true);

  const fromStore = useMemo(() => {
    return (
      transactions.find(
        (t) => String(t.id) === String(id) || t.transactionCode === id
      ) || null
    );
  }, [transactions, id]);

  useEffect(() => {
    if (!id) return;
    if (transactions.length === 0) {
      void fetchTransactions();
    }
  }, [id, transactions.length, fetchTransactions]);

  useEffect(() => {
    if (!id) {
      setRemote(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Always hit detail API for owner-only paymentResume (snap_token).
        // Depend only on `id` — list store refreshes must not cancel this fetch.
        const res = await transactionService.getById(id);
        if (cancelled) return;
        if (res.success && res.data) {
          let detail = normalizeDetailTransaction(res.data);
          // FR-TOPUP-UX-02 — if still waiting, reconcile Midtrans (authoritative expire/settlement).
          // Do not invent expiry from UI timers or Snap close.
          const pendingTopUp =
            isWalletTopUpService(
              detail.serviceName,
              detail.paymentMethod,
              detail.invoice_number || detail.transactionCode
            ) && isPendingStatus(detail.statusRaw || detail.status);
          if (pendingTopUp) {
            try {
              const synced = await transactionService.syncPayment(String(detail.id || id));
              if (!cancelled && synced.success && synced.data) {
                detail = normalizeDetailTransaction(synced.data);
              }
            } catch {
              // Keep detail from GET; Midtrans may be temporarily unreachable.
            }
          }
          if (!cancelled) setRemote(detail);
        } else if (!fromStore) {
          setError(res.message || 'Transaksi tidak ditemukan.');
        }
      } catch (err: any) {
        if (!cancelled && !fromStore) {
          setError(err?.message || 'Gagal memuat detail transaksi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fromStore is fallback display only
  }, [id]);

  // Prefer detail payload (has paymentResume); fall back to list row while loading.
  const tx = remote || fromStore;

  useEffect(() => {
    if (!tx) {
      setReceiptData(null);
      setLoadingReceipt(false);
      return;
    }
    let cancelled = false;
    const key = tx.id || tx.invoice_number || tx.transactionCode;
    if (!key) {
      setLoadingReceipt(false);
      return;
    }
    setLoadingReceipt(true);
    transactionService
      .getReceipt(String(key))
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        setReceiptData(res.data);
      })
      .catch(() => {
        if (!cancelled) setReceiptData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingReceipt(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tx]);

  const refreshAfterPaymentSignal = async (opts?: { assumeClosed?: boolean }) => {
    try {
      const synced = await transactionService.syncPayment(id);
      if (synced.success && synced.data) {
        const detail = normalizeDetailTransaction(synced.data);
        setRemote(detail);
        void fetchTransactions();
        if (isExpiredStatus(detail.statusRaw || detail.status)) {
          setResumeMsg(null);
          return;
        }
        if (isSuccessStatus(detail.statusRaw || detail.status)) {
          setResumeMsg('Pembayaran dikonfirmasi. Saldo Anda telah ditambahkan.');
          return;
        }
        if (opts?.assumeClosed) {
          setResumeMsg('Jendela ditutup. Transaksi tetap menunggu pembayaran — bukan dibatalkan.');
        }
        return;
      }
    } catch {
      // fall through
    }
    void transactionService.getById(id).then((res) => {
      if (res.success && res.data) setRemote(normalizeDetailTransaction(res.data));
    });
    void fetchTransactions();
  };

  const resumePayment = async () => {
    setResumeBusy(true);
    setResumeMsg(null);
    try {
      // Authoritative check before opening Snap — may already be expire/settlement.
      const synced = await transactionService.syncPayment(id);
      if (synced.success && synced.data) {
        const detail = normalizeDetailTransaction(synced.data);
        setRemote(detail);
        if (isExpiredStatus(detail.statusRaw || detail.status)) {
          setResumeMsg(null);
          return;
        }
        if (!detail.paymentResume?.canResume || !detail.paymentResume.snapToken) {
          setResumeMsg('Pembayaran tidak dapat dilanjutkan.');
          return;
        }
      }

      const resume = (synced.success && synced.data
        ? normalizeDetailTransaction(synced.data).paymentResume
        : tx?.paymentResume) as PaymentResumeInfo | undefined;
      if (!resume?.canResume || !resume.snapToken) {
        setResumeMsg('Pembayaran tidak dapat dilanjutkan.');
        return;
      }

      const cfgRes = await walletService.getPaymentConfig();
      const snapReady = cfgRes?.data
        ? await ensureMidtransSnap(cfgRes.data as any)
        : typeof window.snap?.pay === 'function';
      if (!snapReady || typeof window.snap?.pay !== 'function') {
        setResumeMsg('SDK pembayaran belum siap. Silakan muat ulang halaman.');
        return;
      }
      window.snap.pay(resume.snapToken, {
        onSuccess: () => {
          setResumeMsg('Menunggu Konfirmasi Pembayaran. Saldo bertambah setelah pembayaran dikonfirmasi.');
          void refreshAfterPaymentSignal();
        },
        onPending: () => {
          setResumeMsg('Menunggu Pembayaran. Selesaikan pembayaran sesuai instruksi di jendela pembayaran.');
        },
        onError: () => {
          // May be Midtrans expire — reconcile; do not assume from UI alone.
          void refreshAfterPaymentSignal();
        },
        onClose: () => {
          // Close ≠ expired. Still reconcile in case Midtrans already expired/settled.
          void refreshAfterPaymentSignal({ assumeClosed: true });
        },
      });
    } catch (err: any) {
      setResumeMsg(err?.message || 'Gagal membuka pembayaran.');
    } finally {
      setResumeBusy(false);
    }
  };

  if (loading && !tx) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24 md:pb-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (error && !tx) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24 md:pb-8">
        <Link
          to="/dashboard/riwayat"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Riwayat
        </Link>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-8 text-center text-sm font-bold text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24 md:pb-8">
        <Link
          to="/dashboard/riwayat"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Riwayat
        </Link>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-600">
          Transaksi tidak ditemukan.
        </div>
      </div>
    );
  }

  // FR-RECEIPT-UI-01 — single classification pass shared with CheckoutSummary's receipt view.
  const receiptFields = resolveReceiptFields({
    receiptData,
    serviceName: tx.serviceName,
    isSuccess: isSuccessStatus(tx.statusRaw || tx.status),
  });

  const receiptPaymentMethodLabel = customerFacingPaymentMethodLabel(
    receiptData?.transaction_details?.payment_method,
    tx.paymentMethodLabel || tx.paymentMethod
  );

  const receiptStatus: 'success' | 'pending' | 'failed' = isSuccessStatus(tx.statusRaw || tx.status)
    ? 'success'
    : isPendingStatus(tx.statusRaw || tx.status)
    ? 'pending'
    : 'failed';

  const notesDisplay = customerFacingTransactionNotes(tx.notes || tx.note, {
    serviceName: tx.serviceName,
    paymentMethod: tx.paymentMethod,
    invoiceNumber: tx.invoice_number,
    transactionCode: tx.transactionCode,
    status: tx.statusRaw || tx.status,
    amount: tx.amount,
  });

  const isTopUp = isWalletTopUpService(
    tx.serviceName,
    tx.paymentMethod,
    tx.invoice_number || tx.transactionCode
  );
  const resume = tx.paymentResume;
  const showResume = Boolean(resume?.canResume && resume.snapToken);
  const showExpiredBlock = isTopUp && isExpiredStatus(tx.statusRaw || tx.status);

  // Real backend-generated PDF (Sprint 8 / FR-USR04) — only meaningful once a real
  // transaction row exists.
  const handleDownloadPdf = tx.id
    ? () => {
        void transactionService.downloadReceiptPdf(String(tx.id)).catch(() => {
          alert('Gagal mengunduh struk PDF.');
        });
      }
    : undefined;

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24 md:pb-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </button>

      {/* Reusable paper receipt (FR-RECEIPT-UI-01) — same component CheckoutSummary uses. */}
      <TransactionReceipt
        status={receiptStatus}
        failureMessage={receiptStatus === 'failed' ? notesDisplay : null}
        pendingMessage={receiptStatus === 'pending' ? notesDisplay : null}
        invoiceNumber={receiptData?.transaction_details?.invoice_number || tx.transactionCode || tx.invoice_number}
        date={receiptData?.transaction_details?.date || tx.date}
        serialNumber={receiptFields.serialNumber}
        category={receiptData?.transaction_details?.service_name || tx.serviceName}
        productName={receiptData?.items?.[0]?.name || tx.productName}
        targetLabel={receiptFields.targetLabel || undefined}
        targetValue={receiptFields.targetValue || receiptData?.transaction_details?.target_number || tx.targetNo}
        paymentMethodLabel={receiptPaymentMethodLabel || undefined}
        price={receiptData?.payment_summary?.subtotal ?? undefined}
        adminFee={receiptData?.payment_summary?.admin_fee ?? tx.adminFee}
        totalPayment={receiptData?.payment_summary?.total_payment ?? tx.totalPayment}
        extraRows={receiptFields.extraRows}
        deliverable={receiptFields.deliverable}
        deliverablePendingLabel={receiptFields.deliverablePendingLabel}
        loading={loadingReceipt}
        onDownloadPdf={handleDownloadPdf}
        onDone={() => navigate(-1)}
        doneLabel="Kembali ke Riwayat"
      />

      {showExpiredBlock && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 space-y-1">
          <p className="text-sm font-extrabold text-rose-800">Pembayaran Kedaluwarsa</p>
          <p className="text-xs text-rose-700 leading-relaxed">
            Pembayaran Top Up ini sudah melewati batas waktu pembayaran.
          </p>
          <p className="text-xs font-bold text-rose-800">
            Tidak dapat dilanjutkan. Silakan buat Top Up baru.
          </p>
        </div>
      )}

      {showResume && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 space-y-2">
          <p className="text-xs text-amber-900 leading-relaxed">
            Pembayaran masih menunggu. Menutup jendela QR tidak membatalkan transaksi.
          </p>
          <button
            type="button"
            disabled={resumeBusy}
            onClick={() => void resumePayment()}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" />
            {resumeBusy ? 'Membuka…' : 'Lanjutkan Pembayaran'}
          </button>
        </div>
      )}

      {resumeMsg && (
        <p className="text-center text-xs font-semibold text-slate-600">{resumeMsg}</p>
      )}

      <Link
        to={`/dashboard/help?tab=chat${tx?.id ? `&transactionId=${tx.id}` : ''}`}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Chat CS
      </Link>
    </div>
  );
}

export default TransactionDetailPage;
