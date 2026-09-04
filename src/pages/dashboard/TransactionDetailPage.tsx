import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { useTransactionStore } from '../../store/transaction.store';
import { transactionService } from '../../services/transaction/transaction.service';
import { walletService } from '../../services/wallet/wallet.service';
import { formatIDR } from '../../utils/currency';
import {
  customerFacingTransactionNotes,
  isExpiredStatus,
  isPendingStatus,
  isSuccessStatus,
  isWalletTopUpService,
  transactionStatusLabel,
} from '../../utils/transactionStatus';
import {
  formatTransactionDateTime,
  formatHistoryTarget,
  maskEmail,
  maskTargetNumber,
  resolveTargetLabel,
} from '../../utils/transactionDisplay';
import { ensureMidtransSnap } from '../../utils/midtransSnap';
import type { PaymentResumeInfo, Transaction } from '../../types';

function normalizeDetailTransaction(row: any): Transaction {
  const paymentResumeRaw = row?.paymentResume || row?.payment_resume || null;
  const paymentResume: PaymentResumeInfo | undefined = paymentResumeRaw
    ? {
        canResume: Boolean(paymentResumeRaw.canResume ?? paymentResumeRaw.can_resume),
        snapToken: paymentResumeRaw.snapToken ?? paymentResumeRaw.snap_token ?? null,
      }
    : undefined;

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
    paymentMethod: row?.paymentMethod || row?.payment_method || null,
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
  const [copied, setCopied] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<string | null>(null);
  const [receiptCode, setReceiptCode] = useState<{ label: string; code: string; url?: string | null } | null>(null);
  const [receiptMeta, setReceiptMeta] = useState<{
    langgananTargetDisplay?: string | null;
    langgananDelivery?: string | null;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

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
          setRemote(normalizeDetailTransaction(res.data));
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
      setReceiptCode(null);
      setReceiptMeta(null);
      return;
    }
    let cancelled = false;
    const key = tx.id || tx.invoice_number || tx.transactionCode;
    if (!key) return;
    transactionService
      .getReceipt(String(key))
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const d = res.data.transaction_details || {};
        setReceiptMeta({
          langgananTargetDisplay: d.langganan_target_display ?? null,
          langgananDelivery: d.langganan_delivery ?? null,
        });
        if (d.voucher_code) {
          setReceiptCode({ label: 'Kode Voucher', code: d.voucher_code, url: d.voucher_url });
        } else if (d.activation_code) {
          setReceiptCode({ label: 'Kode Aktivasi', code: d.activation_code, url: d.activation_url });
        } else if (d.voucher_internet_code) {
          setReceiptCode({ label: 'Kode Voucher Internet', code: d.voucher_internet_code, url: d.voucher_internet_url });
        } else {
          setReceiptCode(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReceiptCode(null);
          setReceiptMeta(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tx]);

  const copyInvoice = async () => {
    const code = tx?.transactionCode || tx?.invoice_number || '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyReceiptCode = async () => {
    if (!receiptCode) return;
    try {
      await navigator.clipboard.writeText(receiptCode.code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const resumePayment = async () => {
    const resume = tx?.paymentResume;
    if (!resume?.canResume || !resume.snapToken) {
      setResumeMsg('Pembayaran tidak dapat dilanjutkan.');
      return;
    }
    setResumeBusy(true);
    setResumeMsg(null);
    try {
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
          void fetchTransactions();
          void transactionService.getById(id).then((res) => {
            if (res.success && res.data) setRemote(normalizeDetailTransaction(res.data));
          });
        },
        onPending: () => {
          setResumeMsg('Menunggu Pembayaran. Selesaikan pembayaran sesuai instruksi di jendela pembayaran.');
        },
        onError: () => {
          setResumeMsg('Pembayaran belum berhasil. Anda dapat mencoba lagi selama masih menunggu pembayaran.');
        },
        onClose: () => {
          setResumeMsg('Jendela ditutup. Transaksi tetap menunggu pembayaran — bukan dibatalkan.');
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

  const targetLabel = resolveTargetLabel(
    tx.serviceName,
    tx.targetNo,
    receiptMeta?.langgananDelivery
  );
  const targetValue = (() => {
    const display = String(receiptMeta?.langgananTargetDisplay || '').trim();
    if (display) {
      return display.includes('@') ? maskEmail(display) : maskTargetNumber(display);
    }
    return formatHistoryTarget(tx.targetNo, { serviceName: tx.serviceName });
  })();

  const statusLabel = transactionStatusLabel(tx.status, {
    serviceName: tx.serviceName,
    paymentMethod: tx.paymentMethod,
    statusRaw: tx.statusRaw,
    invoiceNumber: tx.invoice_number,
    transactionCode: tx.transactionCode,
  });

  const notesDisplay = customerFacingTransactionNotes(tx.notes || tx.note, {
    serviceName: tx.serviceName,
    paymentMethod: tx.paymentMethod,
    invoiceNumber: tx.invoice_number,
    transactionCode: tx.transactionCode,
    status: tx.statusRaw || tx.status,
  });

  const isTopUp = isWalletTopUpService(
    tx.serviceName,
    tx.paymentMethod,
    tx.invoice_number || tx.transactionCode
  );
  const resume = tx.paymentResume;
  const showResume = Boolean(resume?.canResume && resume.snapToken);
  const showExpiredBlock = isTopUp && isExpiredStatus(tx.statusRaw || tx.status);

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

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Detail Transaksi
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            {tx.productName || tx.serviceName || 'Transaksi PPOB'}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isSuccessStatus(tx.status) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
            ) : isPendingStatus(tx.status) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                <XCircle className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 px-5 py-5 text-sm">
          <Row label="Invoice" value={tx.transactionCode || tx.invoice_number || '—'} mono />
          <Row label="Layanan" value={tx.serviceName || '—'} />
          <Row label="Produk" value={tx.productName || '—'} />
          <Row label={targetLabel} value={targetValue} />
          <Row label="Tanggal" value={formatTransactionDateTime(tx.date)} />
          <Row label="Nominal" value={formatIDR(tx.amount || 0)} bold />
          {tx.totalPayment != null ? (
            <Row label="Total Bayar" value={formatIDR(tx.totalPayment)} bold />
          ) : null}
          {tx.paymentMethod ? <Row label="Metode" value={String(tx.paymentMethod)} /> : null}
          {receiptCode && (
            <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-primary-700 font-bold">{receiptCode.label}</span>
                <button
                  type="button"
                  onClick={() => void copyReceiptCode()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-primary-700 border border-primary-200 hover:bg-primary-100"
                >
                  {copiedCode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copiedCode ? 'Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="font-mono text-sm font-black text-slate-900 break-all">{receiptCode.code}</p>
              {receiptCode.url && (
                <a href={receiptCode.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-primary-600 underline break-all block">
                  Buka Link Voucher
                </a>
              )}
            </div>
          )}
          {notesDisplay ? (
            <Row label="Catatan" value={notesDisplay} />
          ) : null}

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
            <p className="text-xs font-semibold text-slate-600">{resumeMsg}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => void copyInvoice()}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Tersalin' : 'Salin Invoice'}
          </button>
          <Link
            to={`/dashboard/help?tab=chat${tx?.id ? `&transactionId=${tx.id}` : ''}`}
            className="flex flex-1 items-center justify-center rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700"
          >
            Chat CS
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span
        className={`text-right text-slate-900 ${mono ? 'font-mono text-xs' : 'text-sm'} ${
          bold ? 'font-black' : 'font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default TransactionDetailPage;
